import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="session")
def synth_video(tmp_path_factory):
    """Vídeo sintético: 60 frames 320x240 @30fps, 2 retângulos em movimento."""
    path = tmp_path_factory.mktemp("v") / "synth.mp4"
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"),
                        30.0, (320, 240))
    for i in range(60):
        img = np.full((240, 320, 3), 40, np.uint8)
        cv2.rectangle(img, (10 + i, 50), (40 + i, 150), (0, 255, 0), -1)
        cv2.rectangle(img, (250 - i, 60), (280 - i, 160), (255, 0, 0), -1)
        w.write(img)
    w.release()
    return path
