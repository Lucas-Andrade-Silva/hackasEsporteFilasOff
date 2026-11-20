"""Detector híbrido: TrackNetV3 primeiro; fallback YOLO/cor+forma nos gaps."""
from __future__ import annotations

from typing import Callable, Optional

import numpy as np

from config.settings import TRACKNET_CONF_THRESHOLD
from config.sports_config import SPORTS
from core.schema import Detection
from core.tracknet_detector import TrackNetV3Detector
from core.fallback_detector import YoloBallDetector, ColorShapeDetector


class HybridBallDetector:
    """Combina TrackNetV3 (temporal) com detectores por-frame.

    O TrackNet roda na sequência inteira (aproveita contexto temporal e
    InpaintNet). Nos frames que permanecerem sem posição confiável,
    aciona os fallbacks independentes de contexto.
    """

    def __init__(
        self,
        sport: str,
        use_tracknet: bool = True,
        use_yolo: bool = True,
        use_color: bool = True,
        conf_threshold: float = TRACKNET_CONF_THRESHOLD,
        device: Optional[str] = None,
    ):
        if sport not in SPORTS:
            raise ValueError(f"Esporte desconhecido: {sport}. Use {list(SPORTS)}")
        self.sport = sport
        self.conf_threshold = conf_threshold
        self.tracknet = TrackNetV3Detector(device=device) if use_tracknet else None
        self.yolo = YoloBallDetector() if use_yolo else None
        self.color = ColorShapeDetector(SPORTS[sport]) if use_color else None

    def track(
        self,
        frames_bgr: list[np.ndarray],
        frame_w: int,
        frame_h: int,
        on_progress: Optional[Callable[[float], None]] = None,
    ) -> list[Detection]:
        n = len(frames_bgr)
        if self.tracknet is not None:
            detections = self.tracknet.track(
                frames_bgr, frame_w, frame_h,
                on_progress=(lambda p: on_progress(p * 0.7)) if on_progress else None,
            )
        else:
            detections = [Detection() for _ in frames_bgr]

        # Fallback nos frames fracos/ausentes
        for i, frame in enumerate(frames_bgr):
            d = detections[i]
            if d.detected and d.confidence >= self.conf_threshold:
                continue
            cand = None
            if self.yolo is not None:
                try:
                    cand = self.yolo.detect(frame)
                except Exception:
                    cand = None
            if cand is None and self.color is not None:
                cand = self.color.detect(frame)
            # Só substitui se o candidato for melhor que o atual
            if cand is not None and cand.confidence > d.confidence:
                detections[i] = cand
            if on_progress:
                on_progress(0.7 + 0.3 * (i + 1) / n)
        return detections
