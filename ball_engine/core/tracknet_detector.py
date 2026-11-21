"""Adaptador do TrackNetV3 (qaz812345/TrackNetV3) para o pipeline.

Implementa o mesmo fluxo do predict.py original:
- entrada: janela de seq_len frames RGB 512x288 + fundo mediano (bg_mode do ckpt)
- saída: heatmap sigmoide -> blobs (centroide ponderado) por frame
- ensemble temporal com peso posicional (eval_mode='weight')
- InpaintNet para preencher lacunas marcadas pela máscara de trajetória

Diferenças em relação ao original:
- Inferência em streaming: memória constante em relação ao tamanho do
  trecho (só seq_len + batch frames reduzidos ficam vivos).
- Retorna *todos* os blobs de cada frame (`Candidate`), não só o maior;
  a escolha entre eles é feita por `core.trajectory_filter`.
- InpaintNet é um passo separado (`inpaint`), chamado depois dos
  fallbacks para aproveitar também as posições deles.

Funções utilitárias portadas de test.py/utils do repositório original
(get_ensemble_weight, generate_inpaint_mask).
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Callable, Iterable, Optional

import cv2
import math
import numpy as np
import torch

from config.settings import (
    TRACKNET_REPO_DIR, TRACKNET_CKPT, INPAINTNET_CKPT,
    TRACKNET_HEIGHT, TRACKNET_WIDTH,
)
from core.schema import Detection, SOURCE_INPAINT

if TYPE_CHECKING:
    from core.background import Canvas

# Importa model.py do repositório vendored
if str(TRACKNET_REPO_DIR) not in sys.path:
    sys.path.insert(0, str(TRACKNET_REPO_DIR))
from model import TrackNet, InpaintNet  # noqa: E402

H, W = TRACKNET_HEIGHT, TRACKNET_WIDTH
COOR_TH = (1 / math.sqrt(H ** 2 + W ** 2)) * 50  # mesmo COOR_TH do repo


# ---- blobs do heatmap -----------------------------------------------------

@dataclass
class Candidate:
    """Blob do heatmap em coordenadas do frame original."""
    x: float
    y: float
    peak: float   # valor máximo do heatmap no blob
    mass: float   # soma do heatmap no blob (área x intensidade)


def extract_blobs(heatmap: np.ndarray, sx: float, sy: float,
                  threshold: float = 0.5, max_blobs: int = 5,
                  ox: float = 0.0, oy: float = 0.0) -> list[Candidate]:
    """Blobs do heatmap acima do limiar, ordenados por massa (desc).

    O centro é o centroide ponderado pelo heatmap (subpixel na grade
    512x288), convertido para coordenadas do frame original. O +0.5
    alinha com a convenção do original (centro do retângulo do blob).
    (ox, oy): posição do recorte no canvas, em pixels do canvas.
    """
    binary = (heatmap > threshold).astype(np.uint8)
    if not binary.any():
        return []
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    cands = []
    for k in range(1, n):
        x0, y0, w, h, _ = stats[k]
        sub = heatmap[y0:y0 + h, x0:x0 + w] * (labels[y0:y0 + h, x0:x0 + w] == k)
        mass = float(sub.sum())
        if mass <= 0:
            continue
        yy, xx = np.mgrid[0:h, 0:w]
        cx = x0 + float((sub * xx).sum()) / mass + 0.5
        cy = y0 + float((sub * yy).sum()) / mass + 0.5
        cands.append(Candidate(x=(ox + cx) * sx, y=(oy + cy) * sy,
                               peak=float(sub.max()), mass=mass))
    cands.sort(key=lambda c: c.mass, reverse=True)
    return cands[:max_blobs]


def merge_blobs(cands: list[Candidate], min_dist: float,
                max_blobs: int = 5) -> list[Candidate]:
    """Junta blobs de recortes sobrepostos (o mesmo objeto visto 2x)."""
    kept: list[Candidate] = []
    for c in sorted(cands, key=lambda c: c.mass, reverse=True):
        if all(math.hypot(c.x - k.x, c.y - k.y) > min_dist for k in kept):
            kept.append(c)
    return kept[:max_blobs]


# ---- utilitários portados de test.py -------------------------------------

def get_ensemble_weight(seq_len: int) -> torch.Tensor:
    """Peso posicional triangular (eval_mode='weight' do repo original)."""
    weight = torch.ones(seq_len)
    for i in range(math.ceil(seq_len / 2)):
        weight[i] = i + 1
        weight[seq_len - i - 1] = i + 1
    return weight / weight.sum()


def generate_inpaint_mask(xs, ys, vis, th_h: float) -> np.ndarray:
    """Máscara de lacunas internas da trajetória (portado de test.py)."""
    y = np.asarray(ys, dtype=float)
    vis_pred = np.asarray(vis)
    mask = np.zeros_like(y)
    i = j = 0
    n = len(vis_pred)
    while j < n:
        while i < n - 1 and vis_pred[i] == 1:
            i += 1
        j = i
        while j < n - 1 and vis_pred[j] == 0:
            j += 1
        if j == i:
            break
        if i == 0 and y[j] > th_h:
            mask[:j] = 1
        elif (i > 1 and y[i - 1] > th_h) and (j < n and y[j] > th_h):
            mask[i:j] = 1
        i = j
    return mask


def limit_inpaint_mask(mask: np.ndarray, vis, max_gap: int) -> np.ndarray:
    """Mantém só lacunas internas (detecção dos dois lados) com até max_gap.

    O original também marca a lacuna inicial inteira e lacunas de
    qualquer tamanho; em vídeo real isso gera trajetórias inventadas de
    segundos.
    """
    mask = np.asarray(mask, dtype=float).copy()
    vis = np.asarray(vis)
    n = len(mask)
    i = 0
    while i < n:
        if not mask[i]:
            i += 1
            continue
        j = i
        while j < n and mask[j]:
            j += 1
        internal = i > 0 and j < n and vis[i - 1] and vis[j]
        if not internal or (j - i) > max_gap:
            mask[i:j] = 0
        i = j
    return mask


# ---- detector -------------------------------------------------------------

class TrackNetV3Detector:
    """Rastreador de bola baseado em TrackNetV3 + InpaintNet.

    Uso:
        det = TrackNetV3Detector()
        canvas = Canvas(frame_w, frame_h)                  # core.background
        bg = analyze_background(canvas_frames, fps)         # cortes + fundo
        cands = det.candidates(frames_iter, canvas, bg.median_for)
        # ... escolha de blob / filtro / fallback (hybrid_detector) ...
        detections = det.inpaint(detections, frame_w, frame_h)
    """

    def __init__(
        self,
        tracknet_ckpt: str | Path = TRACKNET_CKPT,
        inpaintnet_ckpt: str | Path | None = INPAINTNET_CKPT,
        device: Optional[str] = None,
        use_inpaint: bool = True,
    ):
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device)

        ckpt = torch.load(str(tracknet_ckpt), map_location=self.device,
                          weights_only=False)
        p = ckpt["param_dict"]
        self.seq_len = p["seq_len"]
        self.bg_mode = p["bg_mode"]
        in_dim = {
            "": self.seq_len * 3,
            "subtract": self.seq_len,
            "subtract_concat": self.seq_len * 4,
            "concat": (self.seq_len + 1) * 3,
        }[self.bg_mode]
        self.tracknet = TrackNet(in_dim=in_dim, out_dim=self.seq_len)
        self.tracknet.load_state_dict(ckpt["model"])
        self.tracknet.to(self.device).eval()

        self.inpainter = (InpaintNetModel(inpaintnet_ckpt, device=str(self.device))
                          if use_inpaint else None)
        if self.inpainter is not None and self.inpainter.net is None:
            self.inpainter = None

    # -- preprocessamento ---------------------------------------------------

    def _build_input(self, small_rgb: list[np.ndarray],
                     median_small: np.ndarray) -> np.ndarray:
        """Tensor de entrada (C, H, W) float32 para uma janela 512x288."""
        seq = np.stack([np.moveaxis(f, -1, 0) for f in small_rgb])  # (L,3,H,W)
        median_ch = np.moveaxis(median_small, -1, 0)  # (3, H, W)

        if self.bg_mode == "subtract":
            diff = np.abs(seq.astype(np.int16) - median_ch[None].astype(np.int16))
            x = diff.sum(axis=1).astype(np.uint8)  # soma nos canais -> (L, H, W)
        elif self.bg_mode == "subtract_concat":
            diff = np.abs(seq.astype(np.int16) - median_ch[None].astype(np.int16))
            diff = diff.sum(axis=1, keepdims=True).astype(np.uint8)
            x = np.concatenate([seq, diff], axis=1).reshape(-1, H, W)
        elif self.bg_mode == "concat":
            x = np.concatenate([median_ch[None], seq], axis=0).reshape(-1, H, W)
        else:
            x = seq.reshape(-1, H, W)
        return x.astype(np.float32) / 255.0

    # -- inferência ----------------------------------------------------------

    @torch.no_grad()
    def candidates(
        self,
        frames_bgr: Iterable[np.ndarray],
        canvas: "Canvas",
        median_for: Callable[[int], np.ndarray],
        n_expected: Optional[int] = None,
        on_progress: Optional[Callable[[float], None]] = None,
        batch_size: int = 8,
    ) -> list[list[Candidate]]:
        """Blobs candidatos por frame, em streaming.

        - `canvas`: grade de trabalho (core.background.Canvas). Cada
          recorte 512x288 é uma sequência independente para o modelo; os
          blobs de recortes sobrepostos são unidos no fim.
        - `median_for(f)`: fundo (canvas RGB) da janela que começa em f.

        Ensemble temporal: o frame f recebe as saídas das janelas que
        começam em f-L+1..f. Assim que a janela que começa em f é
        processada, o heatmap de f está completo: os blobs são extraídos
        e o heatmap descartado. Só ~L + batch_size frames ficam vivos,
        qualquer que seja o tamanho do trecho.
        """
        L = self.seq_len
        T = len(canvas.tiles)
        weight = get_ensemble_weight(L).numpy()
        merge_dist = 6.0 * max(canvas.sx, canvas.sy)

        imgs: dict[int, np.ndarray] = {}            # frame -> canvas RGB
        acc: dict[tuple, np.ndarray] = {}           # (frame, tile) -> heatmap
        wsum: dict[int, float] = {}
        out: list[list[Candidate]] = []
        pending: list[int] = []                     # inícios de janela

        def run_batch(n_total: Optional[int]):
            if not pending:
                return
            items, xs = [], []
            for s in pending:
                last = s + L - 1 if n_total is None else min(s + L - 1, n_total - 1)
                med = median_for(s)
                for k in range(T):
                    clip = [canvas.tile(imgs[min(s + j, last)], k) for j in range(L)]
                    xs.append(self._build_input(clip, canvas.tile(med, k)))
                    items.append((s, k))
            ys = []
            for b in range(0, len(xs), batch_size):
                x = torch.from_numpy(np.stack(xs[b:b + batch_size])).to(self.device)
                ys.append(self.tracknet(x).cpu().numpy())  # (B, L, H, W)
            y = np.concatenate(ys)
            for (s, k), yk in zip(items, y):
                valid = L if n_total is None else min(L, n_total - s)
                for j in range(valid):
                    key = (s + j, k)
                    if key in acc:
                        acc[key] += yk[j] * weight[j]
                    else:
                        acc[key] = yk[j] * weight[j]
                    if k == 0:
                        wsum[s + j] = wsum.get(s + j, 0.0) + float(weight[j])
            s_max = pending[-1]
            pending.clear()
            # Todo frame <= s_max já recebeu todas as suas janelas.
            while len(out) <= s_max:
                f = len(out)
                ws = max(wsum.pop(f), 1e-9)
                blobs = []
                for k, (ox, oy) in enumerate(canvas.tiles):
                    blobs += extract_blobs(acc.pop((f, k)) / ws, canvas.sx,
                                           canvas.sy, ox=ox, oy=oy)
                out.append(merge_blobs(blobs, merge_dist) if T > 1 else blobs)
            for f in [f for f in imgs if f <= s_max]:
                del imgs[f]
            if on_progress and n_expected:
                on_progress(min(1.0, len(out) / n_expected))

        n = 0
        for f, frame in enumerate(frames_bgr):
            imgs[f] = canvas.make(frame)
            n = f + 1
            if f - L + 1 >= 0:
                pending.append(f - L + 1)
                if len(pending) >= batch_size:
                    run_batch(None)
        if n == 0:
            return []
        # Janelas finais (parciais): repetem o último frame, como o original.
        for s in range(max(0, n - L + 1), n):
            pending.append(s)
            if len(pending) >= batch_size:
                run_batch(n)
        run_batch(n)
        if on_progress:
            on_progress(1.0)
        return out

    def inpaint(self, detections, frame_w, frame_h, **kw):
        """Atalho para InpaintNetModel.inpaint (mantido por compatibilidade)."""
        if self.inpainter is None:
            return detections
        return self.inpainter.inpaint(detections, frame_w, frame_h, **kw)


class InpaintNetModel:
    """InpaintNet do TrackNetV3, usável com qualquer detector de bola.

    Recebe só coordenadas (não imagens), então serve tanto para TrackNet
    quanto para VballNet.
    """

    def __init__(self, ckpt: str | Path | None = INPAINTNET_CKPT,
                 device: Optional[str] = None):
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device)
        self.net = None
        if ckpt and Path(ckpt).exists():
            ck = torch.load(str(ckpt), map_location=self.device, weights_only=False)
            self.seq_len = ck["param_dict"]["seq_len"]
            self.net = InpaintNet()
            self.net.load_state_dict(ck["model"])
            self.net.to(self.device).eval()

    @torch.no_grad()
    def inpaint(self, detections: list[Detection], frame_w: int, frame_h: int,
                on_progress: Optional[Callable[[float], None]] = None,
                batch_size: int = 256, max_gap: int = 15) -> list[Detection]:
        """Preenche lacunas internas da trajetória com InpaintNet.

        Entrada: todas as posições *detectadas* (TrackNet e fallbacks).
        Só altera lacunas internas de até `max_gap` frames.
        """
        if self.net is None:
            return detections
        detections = list(detections)
        n = len(detections)
        L = self.seq_len
        vis = [1 if d.detected else 0 for d in detections]
        xs = [d.x if d.detected else 0.0 for d in detections]
        ys = [d.y if d.detected else 0.0 for d in detections]
        mask = generate_inpaint_mask(xs, ys, vis, th_h=frame_h * 0.05)
        mask = limit_inpaint_mask(mask, vis, max_gap)
        if mask.sum() == 0 or n < L:
            return detections

        coor = np.stack([np.asarray(xs) / frame_w,
                         np.asarray(ys) / frame_h], axis=1).astype(np.float32)
        m = mask.reshape(-1, 1).astype(np.float32)

        weight = get_ensemble_weight(L).numpy()
        acc = np.zeros((n, 2), dtype=np.float32)
        wsum = np.zeros(n, dtype=np.float32)

        # Janela i cobre [i, i+L); no fim repete a última posição.
        idx = np.minimum(np.arange(n)[:, None] + np.arange(L)[None], n - 1)
        for b in range(0, n, batch_size):
            ii = idx[b:b + batch_size]
            c, mm = coor[ii], m[ii]                       # (B,L,2), (B,L,1)
            o = self.net(torch.from_numpy(c).to(self.device),
                                torch.from_numpy(mm).to(self.device)).cpu().numpy()
            o = o * mm + c * (1 - mm)
            for k in range(len(ii)):
                i = b + k
                v = min(L, n - i)
                acc[i:i + v] += o[k, :v] * weight[:v, None]
                wsum[i:i + v] += weight[:v]
            if on_progress:
                on_progress(min(1.0, (b + batch_size) / n))

        wsum[wsum == 0] = 1.0
        repaired = acc / wsum[:, None]
        repaired[(repaired[:, 0] < COOR_TH) & (repaired[:, 1] < COOR_TH)] = 0.0

        for f in range(n):
            if mask[f] == 1 and repaired[f, 0] > 0 and repaired[f, 1] > 0:
                detections[f] = Detection(
                    x=float(repaired[f, 0] * frame_w),
                    y=float(repaired[f, 1] * frame_h),
                    confidence=0.5, visibility=True, source=SOURCE_INPAINT,
                )
        return detections
