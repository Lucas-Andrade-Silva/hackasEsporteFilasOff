import pytest

from core.video_processor import iter_frames, probe


def test_probe_metadata(synth_video):
    m = probe(synth_video)
    assert m.frame_count == 60 and m.width == 320 and m.height == 240
    assert abs(m.fps - 30.0) < 0.5 and abs(m.duration - 2.0) < 0.1


def test_probe_invalid_path(tmp_path):
    with pytest.raises(ValueError):
        probe(tmp_path / "nao_existe.mp4")


def test_iter_frames_full(synth_video):
    frames = list(iter_frames(synth_video))
    assert len(frames) == 60
    idx, ts, img = frames[30]
    assert idx == 30 and abs(ts - 1.0) < 0.05 and img.shape == (240, 320, 3)


def test_iter_frames_trim(synth_video):
    frames = list(iter_frames(synth_video, start_s=1.0, end_s=1.5))
    idxs = [i for i, _, _ in frames]
    assert idxs[0] == 30 and idxs[-1] <= 45


def test_timestamps_monotonicos(synth_video):
    ts = [t for _, t, _ in iter_frames(synth_video)]
    assert all(b > a for a, b in zip(ts, ts[1:]))
