"""Rastreamento multi-objeto. ByteTrack via pacote `trackers` (Roboflow).

`Tracker` é ABC para permitir troca futura por BoTSORTTracker/OCSORTTracker
(mesmo pacote) quando a câmera se move — sem reescrever a pipeline.
A associação track_id -> keypoints é feita por IoU da box, sem depender
de internals do tracker.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np
import supervision as sv


class Tracker(ABC):
    @abstractmethod
    def update(self, detections: list) -> list:
        """list[PoseDetection] -> list[(track_id, PoseDetection)]."""


def _iou(a, b) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area = ((a[2] - a[0]) * (a[3] - a[1])
            + (b[2] - b[0]) * (b[3] - b[1]) - inter)
    return inter / area if area > 0 else 0.0


class ByteTrackTracker(Tracker):
    def __init__(self, frame_rate: float = 30.0,
                 track_activation_threshold: float = 0.5,
                 high_conf_det_threshold: float = 0.6,
                 minimum_consecutive_frames: int = 2,
                 lost_track_buffer: int = 30):
        from trackers import ByteTrackTracker as _ByteTrack
        self._bt = _ByteTrack(
            lost_track_buffer=lost_track_buffer,
            frame_rate=frame_rate,
            track_activation_threshold=track_activation_threshold,
            minimum_consecutive_frames=minimum_consecutive_frames,
            high_conf_det_threshold=high_conf_det_threshold)

    def update(self, detections: list) -> list:
        if not detections:
            self._bt.update(sv.Detections.empty())
            return []
        sv_dets = sv.Detections(
            xyxy=np.stack([d.bbox for d in detections]),
            confidence=np.array([d.bbox_conf for d in detections],
                                dtype=np.float32),
            class_id=np.zeros(len(detections), dtype=int))
        tracked = self._bt.update(sv_dets)
        out = []
        if tracked.tracker_id is None:
            return out
        for box, tid in zip(tracked.xyxy, tracked.tracker_id):
            # tid -1 = detecção ainda não confirmada (warmup do tracker):
            # o atleta só entra na saída quando a identidade é confirmada
            if tid is None or int(tid) < 0:
                continue
            i = int(np.argmax([_iou(box, d.bbox) for d in detections]))
            out.append((int(tid), detections[i]))
        return out
