import json

import cv2
import numpy as np

from config.keypoints import NUM_KEYPOINTS
from core.athlete_detector import PoseDetection
from core.pipeline import run


class _FakeEstimator:
    """Duas 'pessoas' sintéticas em movimento; a 2ª some nos frames 15-19."""

    def predict(self, frame_bgr):
        self._n = getattr(self, "_n", -1) + 1
        i = self._n
        dets = [self._mk(60 + i * 2, 120)]
        if not (15 <= i < 20):
            dets.append(self._mk(260 - i * 2, 140, weak=True))
        return dets

    @staticmethod
    def _mk(cx, cy, w=40, h=100, weak=False):
        xy = np.stack([np.full(NUM_KEYPOINTS, cx) + np.arange(NUM_KEYPOINTS),
                       np.linspace(cy - h / 2, cy + h / 2, NUM_KEYPOINTS)],
                      axis=1).astype(np.float32)
        conf = np.full(NUM_KEYPOINTS, 0.9, np.float32)
        if weak:
            conf[10:14] = 0.1   # punhos e quadris fracos -> estimated
        return PoseDetection(
            bbox=np.array([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
                          dtype=np.float32),
            bbox_conf=0.9, xy=xy, conf=conf)


def test_pipeline_synthetic_video(synth_video, tmp_path):
    res = run(synth_video, "volleyball", tmp_path, estimator=_FakeEstimator())
    assert res["frames"] == 60

    lines = res["jsonl_path"].read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 60
    rec = json.loads(lines[30])
    assert rec["frame"] == 30 and "athletes" in rec and rec["sport"] == "volleyball"
    a = rec["athletes"][0]
    assert len(a["pose"]) == 17
    assert {"x", "y", "confidence", "estimated"} <= set(
        a["pose"]["left_shoulder"])

    cap = cv2.VideoCapture(str(res["video_path"]))
    ok, _ = cap.read()
    cap.release()
    assert ok

    def ids(faixa):
        return {a["athlete_id"] for l in faixa
                for a in json.loads(l)["athletes"]}
    assert len(ids(lines[:15]) | ids(lines[20:])) == 2


def test_pipeline_marca_estimated(synth_video, tmp_path):
    res = run(synth_video, "volleyball", tmp_path, estimator=_FakeEstimator())
    lines = res["jsonl_path"].read_text(encoding="utf-8").strip().splitlines()
    rec = json.loads(lines[5])
    fracos = [k for a in rec["athletes"] for k, v in a["pose"].items()
              if v["estimated"]]
    assert "left_hip" in fracos or "right_hip" in fracos


def test_pipeline_respeita_trecho(synth_video, tmp_path):
    res = run(synth_video, "volleyball", tmp_path,
              estimator=_FakeEstimator(), start_s=1.0, end_s=1.5)
    assert res["frames"] == 16
