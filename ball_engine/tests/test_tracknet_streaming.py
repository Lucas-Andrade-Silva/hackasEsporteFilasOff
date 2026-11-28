"""O ensemble em streaming tem que bater com o ensemble "tudo em memória".

Usa uma rede falsa (sem checkpoint): a saída do frame k da janela é o
canal R desse frame, então o heatmap reflete diretamente o conteúdo.
"""
import sys
from pathlib import Path

import numpy as np
import pytest
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.background import Canvas  # noqa: E402
from core.tracknet_detector import (  # noqa: E402
    H, W, TrackNetV3Detector, extract_blobs, get_ensemble_weight,
)

L = 8


class FakeNet(torch.nn.Module):
    def forward(self, x):  # x: (B, 3 + 3L, H, W) em bg_mode='concat'
        return x[:, 3::3][:, :L] * 0.9 + 0.05


def _detector():
    det = TrackNetV3Detector.__new__(TrackNetV3Detector)
    det.device = torch.device("cpu")
    det.seq_len = L
    det.bg_mode = "concat"
    det.tracknet = FakeNet()
    det.inpainter = None
    return det


def _frames(n, w=W * 2, h=H * 2):
    rng = np.random.default_rng(0)
    frames = []
    for i in range(n):
        f = np.zeros((h, w, 3), np.uint8)
        x, y = 40 + 17 * i, 60 + int(rng.integers(0, 300))
        f[y:y + 12, x:x + 12, 2] = 255     # canal R (BGR)
        if i % 3 == 0:                      # segundo blob em alguns frames
            f[20:30, 900:910, 2] = 255
        frames.append(f)
    return frames


def _naive(det, frames, fw, fh):
    """Algoritmo antigo: todas as janelas e heatmaps em memória."""
    n = len(frames)
    canvas = Canvas(fw, fh)
    small = [canvas.make(f) for f in frames]
    median = np.zeros((H, W, 3), np.uint8)
    weight = get_ensemble_weight(L).numpy()
    acc = np.zeros((n, H, W), np.float32)
    wsum = np.zeros(n, np.float32)
    for i in range(n):
        valid = min(L, n - i)
        clip = small[i:i + valid] + [small[-1]] * (L - valid)
        x = torch.from_numpy(det._build_input(clip, median)[None])
        y = det.tracknet(x).numpy()[0]
        for k in range(valid):
            acc[i + k] += y[k] * weight[k]
            wsum[i + k] += weight[k]
    hms = acc / wsum[:, None, None]
    return [extract_blobs(hm, fw / W, fh / H) for hm in hms]


@pytest.mark.parametrize("n,batch", [(20, 3), (20, 8), (5, 4), (1, 8)])
def test_streaming_matches_naive(n, batch):
    det = _detector()
    frames = _frames(n)
    fh, fw = frames[0].shape[:2]
    median = np.zeros((H, W, 3), np.uint8)
    got = det.candidates(iter(frames), Canvas(fw, fh), lambda f: median,
                         batch_size=batch)
    want = _naive(det, frames, fw, fh)
    assert len(got) == n
    for g, w in zip(got, want):
        assert len(g) == len(w)
        for a, b in zip(g, w):
            assert a.x == pytest.approx(b.x, abs=1e-3)
            assert a.y == pytest.approx(b.y, abs=1e-3)
            assert a.mass == pytest.approx(b.mass, rel=1e-5)


def test_blob_centroid_is_subpixel_and_in_frame_coords():
    hm = np.zeros((H, W), np.float32)
    hm[100, 200] = 1.0
    hm[100, 201] = 1.0
    (c,) = extract_blobs(hm, sx=2.0, sy=3.0)
    assert c.x == pytest.approx((201.0) * 2.0)   # centro entre 200 e 201 (+0.5)
    assert c.y == pytest.approx(100.5 * 3.0)


def test_portrait_video_uses_tiles_and_keeps_coordinates():
    """Vídeo vertical 1080x1920: bola na parte de baixo é achada no lugar certo."""
    det = _detector()
    fw, fh = 1080, 1920
    canvas = Canvas(fw, fh)
    assert (canvas.width, canvas.height) == (512, 910) and len(canvas.tiles) == 4
    frames = []
    for i in range(10):
        f = np.zeros((fh, fw, 3), np.uint8)
        x, y = 300 + 10 * i, 1600
        f[y - 12:y + 12, x - 12:x + 12, 2] = 255
        frames.append(f)
    med = np.zeros((canvas.height, canvas.width, 3), np.uint8)
    got = det.candidates(iter(frames), canvas, lambda f: med)
    for i, cands in enumerate(got):
        assert len(cands) == 1      # recortes sobrepostos não duplicam a bola
        assert cands[0].x == pytest.approx(300 + 10 * i, abs=4)
        assert cands[0].y == pytest.approx(1600, abs=4)


def test_landscape_close_to_16_9_is_single_tile():
    assert len(Canvas(960, 544).tiles) == 1
    assert len(Canvas(1920, 1080).tiles) == 1
    assert len(Canvas(1440, 1080).tiles) == 2   # 4:3
