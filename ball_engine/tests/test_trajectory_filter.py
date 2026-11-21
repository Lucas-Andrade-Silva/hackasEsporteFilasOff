import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.schema import Detection, SOURCE_TRACKNET  # noqa: E402
from core.tracknet_detector import Candidate  # noqa: E402
from core.trajectory_filter import (  # noqa: E402
    MotionModel, predict_position, reject_outliers, select_candidates,
)

# 10 px/frame no máximo, 5 px de folga
MOTION = MotionModel(max_step=10.0, margin=5.0, max_radius=200.0, context=8)


def _det(x, y):
    return Detection(x=x, y=y, confidence=0.9, visibility=True,
                     source=SOURCE_TRACKNET)


def _line(n, vx=5.0):
    return [_det(100 + vx * i, 100.0) for i in range(n)]


def test_motion_model_scales_with_fps_and_resolution():
    m30 = MotionModel.from_sport(1920, 1080, 30.0, max_speed_diag_s=1.5)
    m60 = MotionModel.from_sport(1920, 1080, 60.0, max_speed_diag_s=1.5)
    assert abs(m30.max_step - 2 * m60.max_step) < 1e-6
    assert m30.allowed(1000) == m30.max_radius


def test_predict_interpolates_between_neighbors():
    dets = _line(5)
    dets[2] = Detection()
    pred = predict_position(dets, 2, MOTION)
    assert pred.two_sided and pred.dt == 1
    assert abs(pred.x - 110.0) < 1e-6 and abs(pred.y - 100.0) < 1e-6


def test_predict_extrapolates_forward_and_backward():
    dets = _line(3) + [Detection()]
    pred = predict_position(dets, 3, MOTION)
    assert not pred.two_sided and abs(pred.x - 115.0) < 1e-6
    dets = [Detection()] + _line(3)
    pred = predict_position(dets, 0, MOTION)
    # pontos em 1..3 com x = 100,105,110 -> frame 0 = 95
    assert abs(pred.x - 95.0) < 1e-6


def test_predict_without_context_is_none():
    assert predict_position([Detection()] * 20, 10, MOTION) is None


def test_reject_isolated_spike():
    dets = _line(9)
    dets[4] = _det(400.0, 400.0)  # salto impossível
    out, n = reject_outliers(dets, MOTION)
    assert n == 1 and not out[4].visibility
    assert all(out[i].visibility for i in range(9) if i != 4)


def test_reject_keeps_consistent_fast_motion():
    out, n = reject_outliers(_line(9, vx=9.0), MOTION)
    assert n == 0


def test_reject_spike_at_segment_edge():
    dets = _line(6) + [_det(600.0, 600.0)]
    out, n = reject_outliers(dets, MOTION)
    assert n == 1 and not out[6].visibility and out[5].visibility


def test_select_prefers_blob_on_trajectory_over_bigger_one():
    cands = [[Candidate(100 + 5 * i, 100, 0.9, 10.0)] for i in range(7)]
    # frame 3: um blob maior longe (ex.: cabeça do jogador) e a bola
    cands[3] = [Candidate(500, 500, 0.9, 50.0), Candidate(115, 100, 0.8, 5.0)]
    dets = select_candidates(cands, MOTION)
    assert abs(dets[3].x - 115) < 1e-6
    assert not select_candidates([[]], MOTION)[0].visibility
