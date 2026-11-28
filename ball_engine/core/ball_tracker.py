"""Monta os FrameRecords a partir das detecções e trata lacunas curtas.

- Gaps de 1-2 frames entre detecções: interpolação linear (estimated=True).
- Gaps maiores: permanecem sem posição (oclusão/fora de cena).
- Campos suavizados (x_smooth/y_smooth via Savitzky-Golay) ficam em
  `meta` por frame? Não: suavização é derivada e não substitui o bruto —
  exposta via função separada usada por overlay e física.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import savgol_filter

from config.settings import MAX_LINEAR_GAP
from core.schema import (
    Detection, FrameRecord, TrackingResult,
    SOURCE_INTERPOLATED, SOURCE_NONE,
)
from core.video_processor import timestamp_of


def interpolate_short_gaps(detections: list[Detection],
                           max_gap: int = MAX_LINEAR_GAP,
                           breaks: tuple = ()) -> list[Detection]:
    """Preenche gaps curtos entre duas detecções com interpolação linear.

    `breaks`: índices onde começa uma nova tomada (corte de cena); um gap
    que atravessa um corte nunca é interpolado.
    """
    det = list(detections)
    n = len(det)
    i = 0
    while i < n:
        if det[i].visibility:
            i += 1
            continue
        j = i
        while j < n and not det[j].visibility:
            j += 1
        gap = j - i
        crosses_cut = any(i - 1 < b <= j for b in breaks)
        if (0 < i and j < n and gap <= max_gap and not crosses_cut
                and det[i - 1].detected and det[j].detected):
            x0, y0 = det[i - 1].x, det[i - 1].y
            x1, y1 = det[j].x, det[j].y
            for k in range(gap):
                t = (k + 1) / (gap + 1)
                det[i + k] = Detection(
                    x=x0 + (x1 - x0) * t, y=y0 + (y1 - y0) * t,
                    confidence=min(det[i - 1].confidence, det[j].confidence) * 0.5,
                    visibility=True, source=SOURCE_INTERPOLATED,
                )
        i = j
    return det


def smooth_trajectory(xs: np.ndarray, ys: np.ndarray, vis: np.ndarray,
                      window: int = 7, poly: int = 2):
    """Savitzky-Golay sobre trechos contínuos visíveis.

    Suaviza só dentro de segmentos contínuos — não atravessa gaps nem
    apaga mudanças reais de direção em quebras de segmento.
    Retorna (xs_s, ys_s) com NaN onde não há posição.
    """
    xs_s = np.full_like(xs, np.nan, dtype=float)
    ys_s = np.full_like(ys, np.nan, dtype=float)
    xs = np.asarray(xs, float)
    ys = np.asarray(ys, float)
    vis = np.asarray(vis, bool)

    i = 0
    n = len(xs)
    while i < n:
        if not vis[i]:
            i += 1
            continue
        j = i
        while j < n and vis[j]:
            j += 1
        seg = j - i
        w = min(window, seg if seg % 2 == 1 else seg - 1)
        if w >= 3:
            xs_s[i:j] = savgol_filter(xs[i:j], w, poly)
            ys_s[i:j] = savgol_filter(ys[i:j], w, poly)
        else:
            xs_s[i:j] = xs[i:j]
            ys_s[i:j] = ys[i:j]
        i = j
    return xs_s, ys_s


def build_result(
    detections: list[Detection],
    start_frame: int,
    fps: float,
    video_path: str,
    sport: str,
    width: int,
    height: int,
    frame_count: int,
    interpolate_gaps: bool = True,
    breaks: tuple = (),
) -> TrackingResult:
    """Converte detecções em TrackingResult com timestamps reais."""
    if interpolate_gaps:
        detections = interpolate_short_gaps(detections, breaks=breaks)
    records = []
    for k, d in enumerate(detections):
        frame_idx = start_frame + k
        records.append(FrameRecord(
            frame=frame_idx,
            timestamp=timestamp_of(frame_idx, fps),
            ball=d,
        ))
    return TrackingResult(
        video_path=str(video_path), sport=sport, fps=fps,
        width=width, height=height, frame_count=frame_count,
        processed_start=start_frame, records=records,
        meta={"detector": "hybrid(modelo de bola + fallback)"},
    )


def detected_arrays(result: TrackingResult):
    """(xs, ys, vis) numpy dos registros — base p/ física e overlay."""
    xs = np.array([r.ball.x if r.ball.visibility else np.nan
                   for r in result.records], float)
    ys = np.array([r.ball.y if r.ball.visibility else np.nan
                   for r in result.records], float)
    vis = np.array([r.ball.visibility for r in result.records], bool)
    return xs, ys, vis
