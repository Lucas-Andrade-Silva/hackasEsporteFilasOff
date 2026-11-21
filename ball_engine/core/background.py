"""Grade de trabalho do TrackNet, cortes de cena e fundo mediano.

O TrackNetV3 (bg_mode='concat') recebe, além dos frames, um "fundo"
mediano. O repositório original usa uma mediana única do vídeo, o que
pressupõe câmera parada e sem cortes. Aqui:

- **Canvas**: o frame é reduzido mantendo a proporção até cobrir
  512x288. Vídeo 16:9 continua igual (1 recorte); vídeo vertical vira,
  por exemplo, 512x910 e é coberto por recortes 512x288 sobrepostos —
  a bola mantém escala uniforme em vez de ser achatada 3x na vertical.
- **Tomadas**: cortes de cena detectados por correlação de histograma
  HSV entre frames seguidos. Cada tomada é processada separadamente.
- **Fundo**: por tomada. Câmera parada -> uma mediana para a tomada
  toda. Câmera em movimento (deslocamento global por correlação de
  fase) -> mediana por janela curta (BG_BLOCK_S).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable, Optional

import cv2
import numpy as np

from config.settings import (
    TRACKNET_HEIGHT as H, TRACKNET_WIDTH as W,
    SCENE_CUT_HIST_CORR, CAMERA_MOTION_PX, BG_BLOCK_S, BG_SAMPLES_PER_BLOCK,
    MEDIAN_SAMPLE_MAX,
)

# Proporções até 10% longe de 16:9 são só redimensionadas (como no
# original) — evita dobrar o custo por 2 px de sobra.
_ASPECT_TOLERANCE = 1.10


def _spread(total: int, size: int, overlap: float = 0.25) -> list[int]:
    """Posições iniciais de recortes de `size` cobrindo `total` com sobreposição."""
    if total <= size:
        return [0]
    k = math.ceil((total - size) / (size * (1 - overlap))) + 1
    return [int(round(p)) for p in np.linspace(0, total - size, k)]


@dataclass
class Canvas:
    """Mapeia frames de qualquer proporção para recortes do tamanho do modelo.

    tile_w x tile_h: 512x288 (TrackNetV3, padrão) ou 768x432 (VballNet).
    """
    frame_w: int
    frame_h: int
    tile_w: int = W
    tile_h: int = H
    width: int = field(init=False)
    height: int = field(init=False)
    tiles: list = field(init=False)   # [(x0, y0)] no canvas

    def __post_init__(self):
        tw, th = self.tile_w, self.tile_h
        sx, sy = tw / self.frame_w, th / self.frame_h
        if max(sx, sy) / min(sx, sy) <= _ASPECT_TOLERANCE:
            self.width, self.height = tw, th
        else:
            s = max(sx, sy)
            self.width = max(tw, int(round(self.frame_w * s)))
            self.height = max(th, int(round(self.frame_h * s)))
        self.tiles = [(x, y) for y in _spread(self.height, th)
                      for x in _spread(self.width, tw)]

    @property
    def sx(self) -> float:
        """Pixels do frame por pixel do canvas (x)."""
        return self.frame_w / self.width

    @property
    def sy(self) -> float:
        return self.frame_h / self.height

    def make(self, frame_bgr: np.ndarray) -> np.ndarray:
        """Frame BGR -> canvas RGB uint8."""
        # interpolação padrão (linear), igual ao pré-processamento do original
        small = cv2.resize(frame_bgr, (self.width, self.height))
        return cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

    def tile(self, canvas_img: np.ndarray, k: int) -> np.ndarray:
        x, y = self.tiles[k]
        return canvas_img[y:y + self.tile_h, x:x + self.tile_w]


@dataclass
class Shot:
    start: int      # primeiro frame (relativo ao trecho)
    end: int        # exclusivo
    moving: bool    # câmera em movimento


@dataclass
class BackgroundModel:
    shots: list
    medians: list               # canvas RGB uint8, um por bloco
    block_of: np.ndarray        # frame -> índice em medians

    def median_for(self, f: int) -> np.ndarray:
        return self.medians[int(self.block_of[f])]


def _hist(canvas_img: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(canvas_img, cv2.COLOR_RGB2HSV)
    h = cv2.calcHist([hsv], [0, 1], None, [16, 16], [0, 180, 0, 256])
    return cv2.normalize(h, h).flatten()


def analyze_background(
    canvas_frames: Iterable[np.ndarray],
    fps: float,
    cut_corr: float = SCENE_CUT_HIST_CORR,
    motion_px: float = CAMERA_MOTION_PX,
    block_s: float = BG_BLOCK_S,
    samples_per_block: int = BG_SAMPLES_PER_BLOCK,
) -> Optional[BackgroundModel]:
    """Uma passada pelo trecho: cortes, movimento de câmera e medianas.

    Memória: medianas por bloco (~1 por segundo) + amostras da tomada
    atual (no máximo ~2*MEDIAN_SAMPLE_MAX frames do canvas).
    """
    block_len = max(1, int(round((fps or 30.0) * block_s)))
    step = max(1, block_len // samples_per_block)

    shots: list[Shot] = []
    shifts: list[float] = []          # deslocamento global (tomada atual)
    medians: list[np.ndarray] = []
    block_of: list[int] = []
    block_start = shot_start = 0
    samples: list[np.ndarray] = []    # bloco atual
    shot_samples: list[np.ndarray] = []
    shot_step, shot_k = 1, 0
    shot_first_block = 0
    prev_hist = prev_gray = None
    n = 0

    def close_block():
        if samples:
            medians.append(np.median(np.stack(samples), axis=0).astype(np.uint8))
            samples.clear()

    def close_shot(end: int):
        sh = np.asarray(shifts[1:]) if len(shifts) > 1 else np.zeros(1)
        # p75: panorâmicas ocupam só parte da tomada; a mediana as ignora
        moving = bool(np.percentile(sh, 75) > motion_px)
        shots.append(Shot(shot_start, end, moving))
        if not moving and shot_samples:
            # Câmera parada: mediana direta de toda a tomada (como o original)
            merged = np.median(np.stack(shot_samples), axis=0).astype(np.uint8)
            for b in range(shot_first_block, len(medians)):
                medians[b] = merged

    for f, img in enumerate(canvas_frames):
        hist = _hist(img)
        gray = cv2.cvtColor(cv2.resize(img, (256, int(256 * img.shape[0] / img.shape[1]))),
                            cv2.COLOR_RGB2GRAY).astype(np.float32)
        is_cut = prev_hist is not None and \
            cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL) < cut_corr
        if f > 0 and (is_cut or f - block_start >= block_len):
            close_block()
            block_start = f
        if is_cut:
            close_shot(f)
            shot_start, shot_first_block = f, len(medians)
            shifts, shot_samples, shot_step, shot_k = [], [], 1, 0
        if prev_gray is not None and not is_cut:
            (dx, dy), _ = cv2.phaseCorrelate(prev_gray, gray)
            shifts.append(math.hypot(dx, dy))
        else:
            shifts.append(0.0)
        if (f - block_start) % step == 0:
            samples.append(img)
            if shot_k % shot_step == 0:
                shot_samples.append(img)
                if len(shot_samples) > 2 * MEDIAN_SAMPLE_MAX:
                    shot_samples = shot_samples[::2]
                    shot_step *= 2
            shot_k += 1
        block_of.append(len(medians))
        prev_hist, prev_gray = hist, gray
        n = f + 1
    close_block()
    if n == 0:
        return None
    close_shot(n)
    return BackgroundModel(shots=shots, medians=medians,
                           block_of=np.asarray(block_of))
