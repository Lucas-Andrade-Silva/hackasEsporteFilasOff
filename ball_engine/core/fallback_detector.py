"""Detectores de fallback para quando o TrackNet não encontra a bola.

Ordem: YOLO (classe 'sports ball') -> cor+forma (HSV + circularidade).
Carregados sob demanda para não pesar a inicialização.
"""
from __future__ import annotations

from typing import Optional

import cv2
import numpy as np

from core.schema import Detection, SOURCE_YOLO, SOURCE_COLOR


class YoloBallDetector:
    """YOLOv8 com filtro para a classe 'sports ball' (COCO id 32)."""

    def __init__(self, model_name: str = "yolov8n.pt", conf: float = 0.25):
        self._model = None
        self._model_name = model_name
        self.conf = conf

    def _load(self):
        if self._model is None:
            from ultralytics import YOLO
            self._model = YOLO(self._model_name)
        return self._model

    def detect(self, frame_bgr: np.ndarray) -> Optional[Detection]:
        model = self._load()
        res = model.predict(frame_bgr, classes=[32], conf=self.conf,
                            verbose=False)[0]
        if res.boxes is None or len(res.boxes) == 0:
            return None
        # Caixa de maior confiança
        i = int(res.boxes.conf.argmax())
        x1, y1, x2, y2 = res.boxes.xyxy[i].tolist()
        return Detection(
            x=(x1 + x2) / 2, y=(y1 + y2) / 2,
            confidence=float(res.boxes.conf[i]),
            visibility=True, source=SOURCE_YOLO,
        )


class ColorShapeDetector:
    """Heurística cor + forma por esporte (HSV -> contornos circulares)."""

    def __init__(self, sport_cfg: dict):
        self.ranges = sport_cfg["hsv_ranges"]
        self.area_frac = sport_cfg["ball_area_frac"]

    def detect(self, frame_bgr: np.ndarray) -> Optional[Detection]:
        hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
        frame_area = frame_bgr.shape[0] * frame_bgr.shape[1]
        mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
        for lo, hi in self.ranges:
            mask |= cv2.inRange(hsv, np.array(lo, np.uint8),
                                np.array(hi, np.uint8))
        mask = cv2.medianBlur(mask, 5)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
        best, best_score = None, 0.0
        a_min, a_max = self.area_frac[0] * frame_area, self.area_frac[1] * frame_area
        for c in cnts:
            area = cv2.contourArea(c)
            if not (a_min <= area <= a_max):
                continue
            per = cv2.arcLength(c, True)
            if per == 0:
                continue
            circularity = 4 * np.pi * area / (per * per)
            if circularity < 0.6:
                continue
            score = circularity * area
            if score > best_score:
                (cx, cy), _ = cv2.minEnclosingCircle(c)
                best, best_score = (cx, cy), score
        if best is None:
            return None
        return Detection(x=float(best[0]), y=float(best[1]),
                         confidence=min(0.5, best_score / (a_max * 0.5)),
                         visibility=True, source=SOURCE_COLOR)
