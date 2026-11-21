"""Adaptador do VballNet (asigatchov/vball-net-pytorch) em ONNX.

Modelo de grade treinado para vôlei:
- entrada: 9 frames em cinza 768x432, /255 (redimensionados com INTER_AREA,
  como no predict_grid_onnx.py do repositório);
- saída: por frame, grade 27x48 com (conf, x_offset, y_offset).

Integração com o pipeline:
- Mesma interface de `TrackNetV3Detector.candidates`: lista de
  `Candidate` por frame, para o filtro de trajetória escolher.
- Vídeo fora de 16:9 é coberto por recortes 768x432 sobrepostos
  (`Canvas`), em vez de esticado — melhorou muito nos Shorts verticais.
- Até `max_cands` células por recorte acima do limiar (não só a melhor),
  para a trajetória poder descartar reflexos e objetos parados.
- Blocos de 9 frames sem sobreposição (como o pipeline do autor), em
  streaming: só 9 frames ficam em memória.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable, Iterable, Optional

import cv2
import numpy as np

from config.settings import VBALLNET_ONNX, VBALLNET_CONF
from core.background import Canvas
from core.tracknet_detector import Candidate, merge_blobs

IN_W, IN_H = 768, 432


def available(model_path: str | Path = VBALLNET_ONNX) -> bool:
    try:
        import onnxruntime  # noqa: F401
    except ImportError:
        return False
    return Path(model_path).exists()


def decode_cells(out: np.ndarray, threshold: float, max_cands: int = 3,
                 min_cell_dist: int = 2) -> list[tuple[float, float, float]]:
    """(x, y, conf) no recorte 768x432 das melhores células de um frame.

    out: (3, rows, cols) = conf, x_offset, y_offset. Células vizinhas da
    mesma bola (a até `min_cell_dist`) são suprimidas.
    """
    conf = out[0]
    rows, cols = conf.shape
    order = np.argsort(conf, axis=None)[::-1]
    picked: list[tuple[int, int]] = []
    res = []
    for flat in order:
        c = float(conf.flat[flat])
        if c < threshold or len(res) >= max_cands:
            break
        r, k = divmod(int(flat), cols)
        if any(abs(r - pr) <= min_cell_dist and abs(k - pk) <= min_cell_dist
               for pr, pk in picked):
            continue
        picked.append((r, k))
        x = (k + float(out[1, r, k])) * (IN_W / cols)
        y = (r + float(out[2, r, k])) * (IN_H / rows)
        res.append((x, y, c))
    return res


class VballNetDetector:
    """Detector de bola VballNet (grade, ONNX Runtime)."""

    def __init__(self, model_path: str | Path = VBALLNET_ONNX,
                 conf_threshold: float = VBALLNET_CONF,
                 providers: Optional[list[str]] = None):
        import onnxruntime as ort
        if not Path(model_path).exists():
            raise FileNotFoundError(
                f"Pesos do VballNet não encontrados: {model_path}. Veja o README.")
        if providers is None:
            providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider")
                         if p in ort.get_available_providers()]
        self.session = ort.InferenceSession(str(model_path), providers=providers)
        inp = self.session.get_inputs()[0]
        self.input_name = inp.name
        self.seq = int(inp.shape[1])           # 9 (cinza: 1 canal por frame)
        assert (inp.shape[2], inp.shape[3]) == (IN_H, IN_W), inp.shape
        self.planes = int(self.session.get_outputs()[0].shape[1]) // self.seq
        self.conf_threshold = conf_threshold
        self.name = Path(model_path).stem

    def canvas(self, frame_w: int, frame_h: int) -> Canvas:
        return Canvas(frame_w, frame_h, tile_w=IN_W, tile_h=IN_H)

    def _prep(self, frame_bgr: np.ndarray, canvas: Canvas) -> np.ndarray:
        img = cv2.resize(frame_bgr, (canvas.width, canvas.height),
                         interpolation=cv2.INTER_AREA)
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0

    def candidates(
        self,
        frames_bgr: Iterable[np.ndarray],
        frame_w: int,
        frame_h: int,
        n_expected: Optional[int] = None,
        on_progress: Optional[Callable[[float], None]] = None,
        max_cands: int = 3,
    ) -> list[list[Candidate]]:
        """Candidatos por frame (coordenadas do frame original)."""
        canvas = self.canvas(frame_w, frame_h)
        merge_dist = 12.0 * max(canvas.sx, canvas.sy)
        out: list[list[Candidate]] = []
        buf: list[np.ndarray] = []

        def flush():
            n = len(buf)
            while len(buf) < self.seq:          # bloco final: repete o último
                buf.append(buf[-1])
            clips = np.stack([np.stack([canvas.tile(g, k) for g in buf])
                              for k in range(len(canvas.tiles))])
            y = self.session.run(None, {self.input_name: clips})[0]
            rows, cols = y.shape[-2:]
            y = y.reshape(len(canvas.tiles), self.seq, self.planes, rows, cols)
            for j in range(n):
                cands = []
                for k, (ox, oy) in enumerate(canvas.tiles):
                    for x, yy, c in decode_cells(y[k, j], self.conf_threshold,
                                                 max_cands):
                        cands.append(Candidate(x=(ox + x) * canvas.sx,
                                               y=(oy + yy) * canvas.sy,
                                               peak=c, mass=c))
                out.append(merge_blobs(cands, merge_dist, max_cands))
            buf.clear()
            if on_progress and n_expected:
                on_progress(min(1.0, len(out) / n_expected))

        for frame in frames_bgr:
            buf.append(self._prep(frame, canvas))
            if len(buf) == self.seq:
                flush()
        if buf:
            flush()
        if on_progress:
            on_progress(1.0)
        return out
