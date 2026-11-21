import numpy as np

from config.keypoints import NUM_KEYPOINTS
from core.athlete_detector import PoseDetection
from core.athlete_tracker import ByteTrackTracker


def _det(cx, cy, w=40, h=100, conf=0.9):
    xy = np.stack([np.linspace(cx - w / 2, cx + w / 2, NUM_KEYPOINTS),
                   np.linspace(cy - h / 2, cy + h / 2, NUM_KEYPOINTS)],
                  axis=1).astype(np.float32)
    return PoseDetection(
        bbox=np.array([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
                      dtype=np.float32),
        bbox_conf=conf, xy=xy,
        conf=np.full(NUM_KEYPOINTS, 0.9, np.float32))


def test_ids_estaveis_em_movimento():
    trk = ByteTrackTracker(minimum_consecutive_frames=1)
    ids_a, ids_b = [], []
    for i in range(20):
        out = dict(trk.update([_det(100 + i * 3, 200),
                               _det(500 - i * 3, 200)]))
        la = [t for t, d in out.items() if d.bbox[0] < 300]
        lb = [t for t, d in out.items() if d.bbox[0] > 300]
        if la:
            ids_a.append(la[0])
        if lb:
            ids_b.append(lb[0])
    # 1º frame é warmup (ids -1); depois o id tem que ser único e estável
    assert len(ids_a) >= 19 and len(set(ids_a)) == 1
    assert len(ids_b) >= 19 and len(set(ids_b)) == 1
    assert ids_a[0] != ids_b[0]


def test_id_sobrevive_a_oclusao_curta():
    trk = ByteTrackTracker(minimum_consecutive_frames=1)
    tid = None
    for i in range(40):
        dets = [_det(100 + i, 200)]
        if not (15 <= i < 20):  # some 5 frames (< lost_track_buffer)
            dets.append(_det(500, 300))
        out = dict(trk.update(dets))
        parado = [t for t, d in out.items() if abs(d.bbox[0] - 480) < 40]
        if parado:
            if tid is None:
                tid = parado[0]
            elif i >= 20:
                assert parado[0] == tid


def test_sem_deteccoes_retorna_vazio():
    trk = ByteTrackTracker(minimum_consecutive_frames=1)
    assert trk.update([]) == []
