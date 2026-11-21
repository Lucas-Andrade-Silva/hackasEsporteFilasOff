"""Desenho do esqueleto, bbox e track_id sobre o frame (BGR, cv2).

Keypoints detectados: círculo cheio. Estimados (interpolados pelo filtro):
círculo vazio menor — distinção visual exigida pelo spec.
"""
from __future__ import annotations

import cv2
import numpy as np

from config.keypoints import COCO_INDEX, SKELETON_EDGES

_TRACK_COLORS = [
    (0, 255, 0), (255, 160, 0), (0, 200, 255), (255, 0, 255),
    (255, 255, 0), (0, 128, 255), (180, 255, 180), (255, 180, 255),
]


def _color(track_id: int):
    return _TRACK_COLORS[track_id % len(_TRACK_COLORS)]


def draw_frame(frame_bgr, athletes: list) -> np.ndarray:
    out = frame_bgr.copy()
    for a in athletes:
        c = _color(a.track_id)
        x1, y1, x2, y2 = (int(v) for v in a.bbox)
        cv2.rectangle(out, (x1, y1), (x2, y2), c, 2)
        cv2.putText(out, f"#{a.track_id} {a.bbox_confidence:.2f}",
                    (x1, max(14, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, c, 1, cv2.LINE_AA)

        pts = {k.name: k for k in a.pose}
        for na, nb in SKELETON_EDGES:
            ka, kb = pts.get(na), pts.get(nb)
            if ka is None or kb is None or ka.confidence <= 0 \
                    or kb.confidence <= 0:
                continue
            pa = (int(ka.x), int(ka.y))
            pb = (int(kb.x), int(kb.y))
            thick = 1 if (ka.estimated or kb.estimated) else 2
            cv2.line(out, pa, pb, c, thick, cv2.LINE_AA)
        for k in a.pose:
            if k.confidence <= 0:
                continue
            p = (int(k.x), int(k.y))
            if k.estimated:
                cv2.circle(out, p, 3, c, 1, cv2.LINE_AA)
            else:
                cv2.circle(out, p, 3, c, -1, cv2.LINE_AA)
    return out
