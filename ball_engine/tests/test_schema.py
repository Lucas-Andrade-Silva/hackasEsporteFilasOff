import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.schema import (  # noqa: E402
    Detection, FrameRecord, TrackingResult,
    SOURCE_TRACKNET, SOURCE_INTERPOLATED, SOURCE_NONE)


def test_detection_detected_vs_estimated():
    d1 = Detection(x=10, y=20, confidence=0.9, visibility=True,
                   source=SOURCE_TRACKNET)
    assert d1.detected and not d1.estimated
    d2 = Detection(x=10, y=20, confidence=0.4, visibility=True,
                   source=SOURCE_INTERPOLATED)
    assert d2.estimated and not d2.detected
    d3 = Detection()
    assert not d3.detected and not d3.estimated and not d3.visibility


def test_result_json_and_df(tmp_path):
    recs = [
        FrameRecord(frame=0, timestamp=0.0,
                    ball=Detection(10, 20, 0.9, True, SOURCE_TRACKNET)),
        FrameRecord(frame=1, timestamp=1 / 30,
                    ball=Detection(None, None, 0.0, False, SOURCE_NONE)),
    ]
    res = TrackingResult(video_path="v.mp4", sport="volleyball", fps=30.0,
                         width=640, height=360, frame_count=2,
                         processed_start=0, records=recs)
    p = res.to_json(tmp_path / "r.json")
    assert p.exists()
    df = res.to_dataframe()
    assert len(df) == 2 and df.loc[0, "x"] == 10
    stats = res.stats()
    assert stats["detectados"] == 1 and stats["sem_posicao"] == 1
