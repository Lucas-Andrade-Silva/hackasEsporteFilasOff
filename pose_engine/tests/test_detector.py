import numpy as np

from config.keypoints import NUM_KEYPOINTS
from core.athlete_detector import RFDETRPoseEstimator


class _FakeKeyPoints:
    """Replica os atributos do sv.KeyPoints usados pelo wrapper."""

    def __init__(self, xy, kconf, dconf, xyxy):
        self.xy = xy
        self.keypoint_confidence = kconf
        self.detection_confidence = dconf
        self.data = {"xyxy": xyxy}


def _fake_keypoints():
    rng = np.random.default_rng(0)
    xy = rng.uniform(50, 200, size=(2, NUM_KEYPOINTS, 2)).astype(np.float32)
    kconf = np.full((2, NUM_KEYPOINTS), 0.9, dtype=np.float32)
    kconf[1, :5] = 0.1
    dconf = np.array([0.97, 0.88], dtype=np.float32)
    xyxy = np.array([[40, 40, 210, 210], [30, 30, 220, 220]],
                    dtype=np.float32)
    return _FakeKeyPoints(xy, kconf, dconf, xyxy)


class _FakeModel:
    def predict(self, img, threshold=0.5):
        return _fake_keypoints()


def _estimador_stub():
    est = RFDETRPoseEstimator.__new__(RFDETRPoseEstimator)
    est.threshold = 0.5
    est.keypoint_min_conf = 0.5
    est.model = _FakeModel()
    return est


def test_rfdetr_predict_maps_keypoints():
    est = _estimador_stub()
    dets = est.predict(np.zeros((480, 640, 3), np.uint8))
    assert len(dets) == 2
    d = dets[0]
    assert d.xy.shape == (NUM_KEYPOINTS, 2)
    assert d.conf.shape == (NUM_KEYPOINTS,)
    x1, y1, x2, y2 = d.bbox
    assert x2 > x1 and y2 > y1


def test_usa_bbox_e_conf_reais_do_detector():
    est = _estimador_stub()
    dets = est.predict(np.zeros((480, 640, 3), np.uint8))
    np.testing.assert_allclose(dets[0].bbox, [40, 40, 210, 210])
    assert dets[0].bbox_conf == 0.97
    assert dets[1].bbox_conf == 0.88


def test_bbox_cai_na_extensao_dos_keypoints_sem_xyxy():
    class _SemBox:
        xy = np.ones((1, NUM_KEYPOINTS, 2), np.float32) * np.array([100, 50])
        keypoint_confidence = np.full((1, NUM_KEYPOINTS), 0.9, np.float32)
        detection_confidence = np.array([0.9], np.float32)
        data = {}

    class _M:
        def predict(self, img, threshold=0.5):
            return _SemBox()

    est = _estimador_stub()
    est.model = _M()
    d = est.predict(np.zeros((480, 640, 3), np.uint8))[0]
    np.testing.assert_allclose(d.bbox, [100, 50, 100, 50])
