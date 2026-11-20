import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.schema import Detection, SOURCE_TRACKNET, SOURCE_INTERPOLATED  # noqa: E402
from core.ball_tracker import interpolate_short_gaps, smooth_trajectory  # noqa: E402


def _det(x, y, vis=True, src=SOURCE_TRACKNET):
    return Detection(x=x, y=y, confidence=0.9, visibility=vis, source=src)


def test_interp_fills_short_gap():
    dets = [_det(0, 0), Detection(), _det(3, 0)]
    out = interpolate_short_gaps(dets, max_gap=2)
    assert out[1].visibility and out[1].source == SOURCE_INTERPOLATED
    assert abs(out[1].x - 1.5) < 1e-6
    assert out[1].estimated


def test_interp_keeps_long_gap_empty():
    dets = [_det(0, 0)] + [Detection()] * 5 + [_det(60, 0)]
    out = interpolate_short_gaps(dets, max_gap=2)
    assert not any(d.visibility for d in out[1:6])


def test_interp_does_not_touch_edges():
    dets = [Detection(), _det(10, 0), Detection()]
    out = interpolate_short_gaps(dets, max_gap=2)
    assert not out[0].visibility and not out[2].visibility


def test_smoothing_preserves_segments_and_gaps():
    xs = np.array([0, 1, 2, 3, 4, np.nan, np.nan, 10, 11, 12, 13], float)
    ys = np.zeros_like(xs)
    vis = ~np.isnan(xs)
    xs_s, ys_s = smooth_trajectory(xs, ys, vis, window=3)
    assert np.isnan(xs_s[5]) and np.isnan(xs_s[6])
    # extremos de segmento não vazam para o gap
    assert xs_s[4] >= 3.0 and xs_s[7] <= 11.0


def test_smoothing_short_segment_passthrough():
    xs = np.array([5.0, 6.0])
    ys = np.array([0.0, 0.0])
    xs_s, _ = smooth_trajectory(xs, ys, np.array([True, True]))
    assert (xs_s == xs).all()
