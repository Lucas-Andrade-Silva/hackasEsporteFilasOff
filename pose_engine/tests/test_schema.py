import json

from core.schema import FrameResult, Keypoint, TrackedAthlete


def test_keypoint_detected_vs_estimated():
    d = Keypoint("nose", 10.0, 20.0, 0.9, estimated=False)
    assert d.detected and not d.estimated
    e = Keypoint("nose", 11.0, 21.0, 0.3, estimated=True)
    assert e.estimated and not e.detected


def test_frame_result_to_dict_shape():
    kp = Keypoint("left_shoulder", 420.0, 180.0, 0.98)
    ath = TrackedAthlete(track_id=3, bbox=(1.0, 2.0, 3.0, 4.0),
                         bbox_confidence=0.97, pose=[kp])
    fr = FrameResult(frame=120, timestamp=4.0, sport="volleyball",
                     athletes=[ath])
    d = fr.to_dict()
    assert d["frame"] == 120 and d["timestamp"] == 4.0
    assert d["sport"] == "volleyball"
    a = d["athletes"][0]
    assert a["athlete_id"] == 3
    assert a["pose"]["left_shoulder"]["x"] == 420.0
    assert a["pose"]["left_shoulder"]["estimated"] is False


def test_frame_result_to_dict_is_json_serializable():
    kp = Keypoint("nose", 1.0, 2.0, 0.5)
    fr = FrameResult(0, 0.0, "basketball",
                     [TrackedAthlete(1, (0, 0, 1, 1), 0.9, [kp])])
    json.dumps(fr.to_dict())
