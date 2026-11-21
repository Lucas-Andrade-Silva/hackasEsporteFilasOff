import numpy as np
import pytest

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
    """Imita RFDETRInference.predict: lista de imagens -> lista de results."""

    def __init__(self):
        self.calls = []

    def predict(self, imgs, threshold=0.5, include_source_image=True):
        self.calls.append((len(imgs), include_source_image))
        return [_fake_keypoints() for _ in imgs]


def _estimador_stub():
    est = RFDETRPoseEstimator.__new__(RFDETRPoseEstimator)
    est.threshold = 0.5
    est.keypoint_min_conf = 0.5
    est.model = _FakeModel()
    est.batch_size, est._fixed_batch, est.mode = 1, False, "eager"
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
    assert dets[0].bbox_conf == pytest.approx(0.97)
    assert dets[1].bbox_conf == pytest.approx(0.88)


def test_bbox_cai_na_extensao_dos_keypoints_sem_xyxy():
    class _SemBox:
        xy = np.ones((1, NUM_KEYPOINTS, 2), np.float32) * np.array([100, 50])
        keypoint_confidence = np.full((1, NUM_KEYPOINTS), 0.9, np.float32)
        detection_confidence = np.array([0.9], np.float32)
        data = {}

    class _M:
        def predict(self, imgs, threshold=0.5, include_source_image=True):
            return _SemBox()   # resultado escalar também é aceito

    est = _estimador_stub()
    est.model = _M()
    d = est.predict(np.zeros((480, 640, 3), np.uint8))[0]
    np.testing.assert_allclose(d.bbox, [100, 50, 100, 50])


def test_predict_batch_nao_copia_imagem_e_mantem_ordem():
    est = _estimador_stub()
    out = est.predict_batch([np.zeros((48, 64, 3), np.uint8)] * 3)
    assert len(out) == 3 and all(len(d) == 2 for d in out)
    assert est.model.calls == [(3, False)]


def test_lote_fixo_completa_e_corta():
    est = _estimador_stub()
    est.batch_size, est._fixed_batch = 4, True
    out = est.predict_batch([np.zeros((48, 64, 3), np.uint8)] * 2)
    assert len(out) == 2
    assert est.model.calls == [(4, False)]
