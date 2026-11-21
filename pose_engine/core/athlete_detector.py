"""Estimadores de pose. RFDETRKeypointPreview entrega boxes+keypoints por pessoa.

O objeto retornado pelo modelo (sv.KeyPoints) expõe:
  .xy                    (N,17,2)  coordenadas dos keypoints
  .keypoint_confidence   (N,17)    confiança por keypoint
  .detection_confidence  (N,)      confiança da detecção de pessoa
  .data["xyxy"]          (N,4)     bounding boxes reais do detector

Modos de inferência (INFERENCE_MODE):
  "eager"   snapshot otimizado `model.inference(compile=False)` em fp16 na GPU,
            batch flexível, sem tempo de compilação
  "compile" `model.inference(compile=True)`: batch e resolução fixos (o último
            lote é completado repetindo o frame final), ~2 min de compilação
  "none"    `model.predict` original (referência / debug)
Se a criação do snapshot falhar, cai para "none" com um aviso.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

import cv2
import numpy as np

from config.settings import (DETECTION_THRESHOLD, INFERENCE_BATCH,
                             INFERENCE_MODE, KEYPOINT_MIN_CONF)

log = logging.getLogger(__name__)


@dataclass
class PoseDetection:
    bbox: np.ndarray        # (4,) x1,y1,x2,y2
    bbox_conf: float
    xy: np.ndarray          # (K,2)
    conf: np.ndarray        # (K,)


class PoseEstimator(ABC):
    batch_size: int = 1     # quantos frames a pipeline entrega por chamada

    @abstractmethod
    def predict(self, frame_bgr) -> list:
        """Retorna list[PoseDetection] para um frame BGR."""

    def predict_batch(self, frames_bgr: list) -> list:
        """list[frame BGR] -> list[list[PoseDetection]] (mesma ordem)."""
        return [self.predict(f) for f in frames_bgr]


class RFDETRPoseEstimator(PoseEstimator):
    def __init__(self, threshold: float = DETECTION_THRESHOLD,
                 device: str | None = None, mode: str = INFERENCE_MODE,
                 batch_size: int = INFERENCE_BATCH):
        import torch
        from rfdetr import RFDETRKeypointPreview
        if mode not in ("eager", "compile", "none"):
            raise ValueError(f"mode inválido: {mode!r}")
        self.threshold = threshold
        self.keypoint_min_conf = KEYPOINT_MIN_CONF
        kw = {} if device is None else {"device": device}
        base = RFDETRKeypointPreview(**kw)
        use_cuda = torch.cuda.is_available() and (device or "cuda") != "cpu"
        dtype = torch.float16 if use_cuda else torch.float32

        self.model, self.mode, self._fixed_batch = base, "none", False
        self.batch_size = 1
        if mode != "none":
            try:
                self.model = base.inference(
                    compile=(mode == "compile"), batch_size=batch_size,
                    dtype=dtype)
                self.mode, self.batch_size = mode, max(1, batch_size)
                self._fixed_batch = mode == "compile"
            except Exception as e:  # noqa: BLE001 — qualquer falha -> original
                log.warning("inference(%s) falhou (%s); usando predict "
                            "original", mode, e)
        log.info("RF-DETR modo=%s batch=%d dtype=%s", self.mode,
                 self.batch_size, dtype)

    @staticmethod
    def _bbox_from_keypoints(xy, conf, min_conf):
        good = conf >= min_conf
        pts = xy[good] if good.any() else xy
        return np.array([pts[:, 0].min(), pts[:, 1].min(),
                         pts[:, 0].max(), pts[:, 1].max()], dtype=np.float32)

    def _to_detections(self, kps) -> list:
        boxes = kps.data.get("xyxy") if getattr(kps, "data", None) else None
        det_conf = getattr(kps, "detection_confidence", None)
        out = []
        for i in range(len(kps.xy)):
            xy = np.asarray(kps.xy[i], dtype=np.float32)
            conf = np.asarray(kps.keypoint_confidence[i], dtype=np.float32)
            if boxes is not None and len(boxes) > i:
                bbox = np.asarray(boxes[i], dtype=np.float32)
            else:
                bbox = self._bbox_from_keypoints(
                    xy, conf, self.keypoint_min_conf)
            bbox_conf = (float(det_conf[i]) if det_conf is not None
                         else float(conf.max()) if conf.size else 0.0)
            out.append(PoseDetection(bbox=bbox, bbox_conf=bbox_conf,
                                     xy=xy, conf=conf))
        return out

    def predict_batch(self, frames_bgr: list) -> list:
        if not frames_bgr:
            return []
        rgbs = [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) for f in frames_bgr]
        n = len(rgbs)
        if self._fixed_batch and n < self.batch_size:
            rgbs += [rgbs[-1]] * (self.batch_size - n)   # completa o lote
        res = self.model.predict(rgbs, threshold=self.threshold,
                                 include_source_image=False)
        if not isinstance(res, (list, tuple)):
            res = [res]
        return [self._to_detections(k) for k in res[:n]]

    def predict(self, frame_bgr) -> list:
        return self.predict_batch([frame_bgr])[0]
