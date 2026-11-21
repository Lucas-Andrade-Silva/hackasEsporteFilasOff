import numpy as np

from core.schema import Keypoint, TrackedAthlete
from visualization.skeleton_overlay import draw_frame


def _atleta(tid, x0, y0, estimated=False):
    pose = [Keypoint(n, x0 + i * 5, y0 + i * 8, 0.1 if estimated else 0.9,
                     estimated=estimated)
            for i, n in enumerate([
                "nose", "left_eye", "right_eye", "left_ear", "right_ear",
                "left_shoulder", "right_shoulder", "left_elbow",
                "right_elbow", "left_wrist", "right_wrist", "left_hip",
                "right_hip", "left_knee", "right_knee", "left_ankle",
                "right_ankle"])]
    return TrackedAthlete(track_id=tid,
                          bbox=(x0, y0, x0 + 90, y0 + 140),
                          bbox_confidence=0.9, pose=pose)


def test_draw_frame_retorna_imagem_mesmo_shape():
    img = np.zeros((240, 320, 3), np.uint8)
    out = draw_frame(img, [_atleta(1, 100, 60)])
    assert out.shape == img.shape
    assert not np.array_equal(out, img)  # desenhou algo


def test_draw_frame_com_keypoints_estimados():
    img = np.zeros((240, 320, 3), np.uint8)
    out = draw_frame(img, [_atleta(2, 50, 40, estimated=True)])
    assert out.shape == img.shape and out.sum() > 0


def test_draw_frame_sem_atletas_nao_quebra():
    img = np.zeros((240, 320, 3), np.uint8)
    out = draw_frame(img, [])
    assert np.array_equal(out, img)
