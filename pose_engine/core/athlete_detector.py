"""Estimadores de pose. RFDETRKeypointPreview entrega boxes+keypoints por pessoa.

O objeto retornado pelo modelo (sv.KeyPoints) expõe:
  .xy                    (N,17,2)  coordenadas dos keypoints
  .keypoint_confidence   (N,17)    confiança por keypoint
  .detection_confidence  (N,)      confiança da detecção de pessoa
  .data["xyxy"]          (N,4)     bounding boxes reais do detector
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import cv2
import numpy as np

from config.settings import DETECTION_THRESHOLD, KEYPOINT_MIN_CONF


@dataclass
class PoseDetection:
    bbox: np.ndarray        # (4,) x1,y1,x2,y2
    bbox_conf: float
    xy: np.ndarray          # (K,2)
    conf: np.ndarray        # (K,)


class PoseEstimator(ABC):
    @abstractmethod
    def predict(self, frame_bgr) -> list:
        """Retorna list[PoseDetection] para um frame BGR."""


class RFDETRPoseEstimator(PoseEstimator):
    def __init__(self, threshold: float = DETECTION_THRESHOLD,
                 device: str | None = None):
        from rfdetr import RFDETRKeypointPreview
        self.threshold = threshold
        self.keypoint_min_conf = KEYPOINT_MIN_CONF
        kw = {} if device is None else {"device": device}
        self.model = RFDETRKeypointPreview(**kw)

    @staticmethod
    def _bbox_from_keypoints(xy, conf, min_conf):
        good = conf >= min_conf
        pts = xy[good] if good.any() else xy
        return np.array([pts[:, 0].min(), pts[:, 1].min(),
                         pts[:, 0].max(), pts[:, 1].max()], dtype=np.float32)

    def predict(self, frame_bgr) -> list:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        kps = self.model.predict(rgb, threshold=self.threshold)
        boxes = kps.data.get("xyxy") if getattr(kps, "data", None) else None
        out = []
        for i in range(len(kps.xy)):
            xy = np.asarray(kps.xy[i], dtype=np.float32)
            conf = np.asarray(kps.keypoint_confidence[i], dtype=np.float32)
            if boxes is not None and len(boxes) > i:
                bbox = np.asarray(boxes[i], dtype=np.float32)
            else:
                bbox = self._bbox_from_keypoints(
                    xy, conf, self.keypoint_min_conf)
            det_conf = getattr(kps, "detection_confidence", None)
            bbox_conf = (float(det_conf[i]) if det_conf is not None
                         else float(conf.max()) if conf.size else 0.0)
            out.append(PoseDetection(bbox=bbox, bbox_conf=bbox_conf,
                                     xy=xy, conf=conf))
        return out
