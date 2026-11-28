"""Cortes de cena, câmera em movimento, limite do InpaintNet e interpolação."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.background import Canvas, analyze_background  # noqa: E402
from core.ball_tracker import interpolate_short_gaps  # noqa: E402
from core.schema import Detection, SOURCE_TRACKNET  # noqa: E402
from core.tracknet_detector import limit_inpaint_mask  # noqa: E402

RNG = np.random.default_rng(1)


def _scene(color, n, shift_per_frame=0):
    """Cena com textura (para correlação de fase) e cor dominante."""
    base = RNG.integers(0, 60, (400, 700, 3)).astype(np.uint8)
    base[..., :] += np.array(color, np.uint8)
    out = []
    for i in range(n):
        dx = i * shift_per_frame
        out.append(np.ascontiguousarray(base[:288, dx:dx + 512]))
    return out


def test_detects_cut_between_different_scenes():
    frames = _scene((150, 100, 20), 40) + _scene((20, 60, 150), 40)
    bg = analyze_background(iter(frames), fps=30)
    assert [(s.start, s.end) for s in bg.shots] == [(0, 40), (40, 80)]
    # cada tomada tem o próprio fundo
    assert not np.array_equal(bg.median_for(10), bg.median_for(50))


def test_static_camera_single_background_per_shot():
    bg = analyze_background(iter(_scene((100, 100, 100), 90)), fps=30)
    assert len(bg.shots) == 1 and not bg.shots[0].moving
    assert bg.median_for(0) is bg.median_for(89)


def test_panning_camera_uses_short_windows():
    bg = analyze_background(iter(_scene((100, 100, 100), 90, shift_per_frame=2)),
                            fps=30)
    assert len(bg.shots) == 1 and bg.shots[0].moving
    assert not np.array_equal(bg.median_for(0), bg.median_for(89))


def test_canvas_make_shape():
    c = Canvas(720, 1280)
    assert c.make(np.zeros((1280, 720, 3), np.uint8)).shape == (c.height, c.width, 3)


def test_inpaint_mask_only_short_internal_gaps():
    vis = np.array([0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0])
    mask = (1 - vis).astype(float)       # máscara "original": todo buraco
    out = limit_inpaint_mask(mask, vis, max_gap=3)
    # início e fim nunca; buraco de 2 (4-5) sim; buraco de 5 (7-11) não
    assert out.tolist() == [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]


def test_interpolation_does_not_cross_cut():
    d = lambda x: Detection(x=x, y=0, confidence=0.9, visibility=True,  # noqa: E731
                            source=SOURCE_TRACKNET)
    dets = [d(0), Detection(), d(2)]
    assert interpolate_short_gaps(dets, breaks=(1,))[1].visibility is False
    assert interpolate_short_gaps(dets, breaks=(2,))[1].visibility is False
    assert interpolate_short_gaps(dets)[1].visibility is True
