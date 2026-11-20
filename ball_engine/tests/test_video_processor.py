import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.video_processor import probe, read_segment, timestamp_of  # noqa: E402


@pytest.fixture
def synthetic_video(tmp_path):
    path = tmp_path / "synth.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"),
                             30.0, (320, 240))
    for i in range(60):
        frame = np.full((240, 320, 3), i % 255, np.uint8)
        writer.write(frame)
    writer.release()
    return str(path)


def test_probe(synthetic_video):
    info = probe(synthetic_video)
    assert info.fps == pytest.approx(30.0)
    assert info.width == 320 and info.height == 240
    assert info.frame_count == 60
    assert info.duration == pytest.approx(2.0)


def test_read_segment_range(synthetic_video):
    frames = read_segment(synthetic_video, 10, 20)
    assert len(frames) == 10


def test_read_segment_clamps_end(synthetic_video):
    frames = read_segment(synthetic_video, 55, 200)
    assert len(frames) == 5


def test_timestamp():
    assert timestamp_of(30, 30.0) == 1.0
    assert timestamp_of(15, 30.0) == 0.5
