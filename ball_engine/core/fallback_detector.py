"""Detectores de fallback para quando o TrackNet não encontra a bola.

Ordem: YOLO (classe 'sports ball') -> cor+forma (HSV + circularidade).
Ambos devolvem *todos* os candidatos (`detect_all`), opcionalmente só
dentro de uma região de busca (ROI) em volta da posição prevista. A
escolha entre candidatos é feita por quem chama (hybrid_detector), com
base na trajetória. Modelos carregados sob demanda.
"""
from __future__ import annotations

from typing import Optional

import cv2
import numpy as np

from core.schema import Detection, SOURCE_YOLO, SOURCE_COLOR

# (x0, y0, x1, y1) em pixels do frame original
Roi = tuple[int, int, int, int]


def roi_around(x: float, y: float, radius: float, frame_w: int, frame_h: int,
               min_side: int = 160) -> Roi:
    """Quadrado de lado 2*radius (>= min_side) centrado em (x, y), recortado."""
    half = max(radius, min_side / 2)
    x0 = int(max(0, x - half))
    y0 = int(max(0, y - half))
    x1 = int(min(frame_w, x + half))
    y1 = int(min(frame_h, y + half))
    return x0, y0, x1, y1


def _crop(frame: np.ndarray, roi: Optional[Roi]):
    if roi is None:
        return frame, 0, 0
    x0, y0, x1, y1 = roi
    return frame[y0:y1, x0:x1], x0, y0


class YoloBallDetector:
    """YOLOv8 com filtro para a classe 'sports ball' (COCO id 32).

    Rodar num recorte ampliado (ROI) ajuda muito com bola pequena: o
    YOLO redimensiona o recorte para imgsz, então a bola fica maior.
    """

    def __init__(self, model_name: str = "yolov8n.pt", conf: float = 0.25):
        self._model = None
        self._model_name = model_name
        self.conf = conf

    def _load(self):
        if self._model is None:
            from ultralytics import YOLO
            self._model = YOLO(self._model_name)
        return self._model

    def detect_all(self, frame_bgr: np.ndarray, roi: Optional[Roi] = None,
                   conf: Optional[float] = None) -> list[Detection]:
        img, ox, oy = _crop(frame_bgr, roi)
        if img.size == 0:
            return []
        res = self._load().predict(img, classes=[32],
                                   conf=self.conf if conf is None else conf,
                                   verbose=False)[0]
        if res.boxes is None or len(res.boxes) == 0:
            return []
        out = []
        for (x1, y1, x2, y2), c in zip(res.boxes.xyxy.tolist(),
                                       res.boxes.conf.tolist()):
            out.append(Detection(x=ox + (x1 + x2) / 2, y=oy + (y1 + y2) / 2,
                                 confidence=float(c), visibility=True,
                                 source=SOURCE_YOLO))
        return out

    def detect(self, frame_bgr: np.ndarray) -> Optional[Detection]:
        """Maior confiança no frame inteiro (sem contexto temporal)."""
        cands = self.detect_all(frame_bgr)
        return max(cands, key=lambda d: d.confidence) if cands else None


class ColorShapeDetector:
    """Heurística cor + forma por esporte (HSV -> contornos circulares)."""

    def __init__(self, sport_cfg: dict, min_circularity: float = 0.6):
        self.ranges = sport_cfg["hsv_ranges"]
        self.area_frac = sport_cfg["ball_area_frac"]
        self.min_circularity = min_circularity

    def detect_all(self, frame_bgr: np.ndarray, roi: Optional[Roi] = None
                   ) -> list[Detection]:
        # Limites de área relativos ao frame inteiro, mesmo usando ROI
        frame_area = frame_bgr.shape[0] * frame_bgr.shape[1]
        a_min = self.area_frac[0] * frame_area
        a_max = self.area_frac[1] * frame_area
        img, ox, oy = _crop(frame_bgr, roi)
        if img.size == 0:
            return []
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
        for lo, hi in self.ranges:
            mask |= cv2.inRange(hsv, np.array(lo, np.uint8),
                                np.array(hi, np.uint8))
        mask = cv2.medianBlur(mask, 5)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
        out = []
        for c in cnts:
            area = cv2.contourArea(c)
            if not (a_min <= area <= a_max):
                continue
            per = cv2.arcLength(c, True)
            if per == 0:
                continue
            circularity = 4 * np.pi * area / (per * per)
            if circularity < self.min_circularity:
                continue
            (cx, cy), _ = cv2.minEnclosingCircle(c)
            score = circularity * area
            out.append(Detection(x=ox + float(cx), y=oy + float(cy),
                                 confidence=min(0.5, score / (a_max * 0.5)),
                                 visibility=True, source=SOURCE_COLOR))
        return out

    def detect(self, frame_bgr: np.ndarray) -> Optional[Detection]:
        cands = self.detect_all(frame_bgr)
        return max(cands, key=lambda d: d.confidence) if cands else None
