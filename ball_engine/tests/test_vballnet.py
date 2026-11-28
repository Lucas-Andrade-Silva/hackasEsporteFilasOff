"""VballNet sem pesos: decodificação da grade e recortes (sessão ONNX falsa)."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.vballnet_detector import IN_H, IN_W, VballNetDetector, decode_cells  # noqa: E402

ROWS, COLS, SEQ = 27, 48, 9
CELL_W, CELL_H = IN_W / COLS, IN_H / ROWS   # 16 x 16


def _grid(cells):
    """(3, 27, 48) com conf/offsets nas células dadas [(r, c, conf, dx, dy)]."""
    g = np.zeros((3, ROWS, COLS), np.float32)
    for r, c, conf, dx, dy in cells:
        g[:, r, c] = (conf, dx, dy)
    return g


def test_decode_best_cell_with_offsets():
    (x, y, c), = decode_cells(_grid([(10, 20, 0.9, 0.25, 0.5)]), threshold=0.5)
    assert c == pytest.approx(0.9)
    assert x == pytest.approx((20 + 0.25) * CELL_W)
    assert y == pytest.approx((10 + 0.5) * CELL_H)


def test_decode_threshold_and_neighbor_suppression():
    g = _grid([(10, 20, 0.9, 0, 0), (10, 21, 0.85, 0, 0),   # mesma bola
               (2, 40, 0.8, 0, 0), (5, 5, 0.3, 0, 0)])      # outro objeto; fraco
    out = decode_cells(g, threshold=0.5)
    assert len(out) == 2
    assert out[1][0] == pytest.approx(40 * CELL_W)


class FakeSession:
    """Coloca a "bola" sempre na célula (20, 30) do recorte 1."""

    def __init__(self):
        self.calls = []

    def run(self, _, feeds):
        clips = feeds["clip"]               # (tiles, 9, 432, 768)
        self.calls.append(clips.shape)
        out = np.zeros((clips.shape[0], SEQ * 3, ROWS, COLS), np.float32)
        if clips.shape[0] > 1:
            for j in range(SEQ):
                out[1, j * 3:(j + 1) * 3, 20, 30] = (0.9, 0.5, 0.5)
        return [out]


def _detector():
    det = VballNetDetector.__new__(VballNetDetector)
    det.session = FakeSession()
    det.input_name = "clip"
    det.seq, det.planes = SEQ, 3
    det.conf_threshold = 0.7
    det.name = "fake"
    return det


def test_portrait_tiles_and_blocks():
    det = _detector()
    fw, fh = 1080, 1920
    canvas = det.canvas(fw, fh)
    assert canvas.width == IN_W and len(canvas.tiles) == 4
    frames = [np.zeros((fh, fw, 3), np.uint8) for _ in range(20)]  # 9 + 9 + 2
    cands = det.candidates(iter(frames), fw, fh)
    assert len(cands) == 20
    assert [s[0] for s in det.session.calls] == [4, 4, 4]
    ox, oy = canvas.tiles[1]
    (c,) = cands[0]
    assert c.x == pytest.approx((ox + 30.5 * CELL_W) * canvas.sx)
    assert c.y == pytest.approx((oy + 20.5 * CELL_H) * canvas.sy)


def test_landscape_single_tile_no_detection():
    det = _detector()
    cands = det.candidates(iter([np.zeros((1080, 1920, 3), np.uint8)] * 9), 1920, 1080)
    assert det.session.calls[0][0] == 1 and all(c == [] for c in cands)
