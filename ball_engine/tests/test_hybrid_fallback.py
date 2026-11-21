"""Fallback restrito à trajetória (sem checkpoints: YOLO falso)."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.hybrid_detector import HybridBallDetector  # noqa: E402
from core.schema import Detection, SOURCE_TRACKNET, SOURCE_YOLO  # noqa: E402
from core.trajectory_filter import MotionModel  # noqa: E402

MOTION = MotionModel(max_step=10.0, margin=5.0, max_radius=200.0)
FRAME = np.zeros((480, 640, 3), np.uint8)


class FakeYolo:
    def __init__(self, cands):
        self.cands = cands
        self.rois = []

    def detect_all(self, frame, roi=None, conf=None):
        self.rois.append(roi)
        return [Detection(x=x, y=y, confidence=c, visibility=True,
                          source=SOURCE_YOLO) for x, y, c in self.cands]


def _hybrid(yolo):
    h = HybridBallDetector("volleyball", use_tracknet=False,
                           use_yolo=False, use_color=False)
    h.yolo = yolo
    return h


def _track(xs):
    return [Detection(x=x, y=200.0, confidence=0.9, visibility=True,
                      source=SOURCE_TRACKNET) if x is not None else Detection()
            for x in xs]


def _stats():
    return {"fallback_rejeitados_fora_da_trajetoria": 0}


def test_fallback_picks_candidate_on_trajectory():
    # bola esperada em x=120; YOLO acha uma bola longe (outra quadra) e a certa
    yolo = FakeYolo([(500, 400, 0.95), (121, 201, 0.4)])
    h, st = _hybrid(yolo), _stats()
    dets = _track([100, 110, None, 130, 140])
    got = h._fallback_frame(FRAME, dets, 2, MOTION, 640, 480, st)
    assert got is not None and abs(got.x - 121) < 1e-6
    assert st["fallback_rejeitados_fora_da_trajetoria"] == 1
    x0, y0, x1, y1 = yolo.rois[0]          # busca só perto da previsão
    assert x0 <= 120 <= x1 and (x1 - x0) < 640


def test_fallback_rejects_everything_off_trajectory():
    h, st = _hybrid(FakeYolo([(500, 400, 0.99)])), _stats()
    dets = _track([100, 110, None, 130, 140])
    assert h._fallback_frame(FRAME, dets, 2, MOTION, 640, 480, st) is None


def test_fallback_without_context_requires_confident_yolo():
    dets = _track([None] * 20)
    h = _hybrid(FakeYolo([(300, 300, 0.3)]))
    assert h._fallback_frame(FRAME, dets, 10, MOTION, 640, 480, _stats()) is None
