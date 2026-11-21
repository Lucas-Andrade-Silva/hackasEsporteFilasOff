import numpy as np

from core.keypoint_processor import KeypointProcessor, OneEuroFilter
from core.schema import Keypoint


def test_one_euro_reduz_jitter_em_repouso():
    rng = np.random.default_rng(1)
    f = OneEuroFilter(min_cutoff=1.0, beta=0.007)
    ruidoso = 100 + rng.normal(0, 2.0, 60)      # ponto parado com jitter σ=2px
    filtrado = np.array([f(x, dt=1 / 30) for x in ruidoso])
    assert filtrado.std() < ruidoso.std() / 3   # suavização forte em repouso


def test_one_euro_responde_a_movimento_rapido():
    f = OneEuroFilter(min_cutoff=1.0, beta=0.007)
    for _ in range(30):
        f(0.0, dt=1 / 30)                        # converge parado em 0
    saida = [f(5.0 * i, dt=1 / 30) for i in range(1, 31)]  # rampa 150px/s
    assert saida[-1] > 100                       # segue o movimento, não congela
    assert abs(saida[-1] - 150) < 40             # lag limitado pelo beta


def test_processor_marca_estimated_quando_conf_baixa():
    p = KeypointProcessor()
    k_ok = [Keypoint("nose", 100, 100, 0.9)]
    p.process(1, k_ok)
    p.process(1, k_ok)  # cria histórico
    out = p.process(1, [Keypoint("nose", 300, 300, 0.1)])[0]
    assert out.estimated is True
    assert abs(out.x - 100) < 50  # puxado para o histórico, não para 300


def test_processor_conf_zero_sem_historico():
    p = KeypointProcessor()
    out = p.process(7, [Keypoint("nose", 50, 50, 0.1)])[0]
    assert out.estimated is True and out.confidence == 0.0


def test_processor_suaviza_mantendo_detected():
    p = KeypointProcessor()
    out = p.process(1, [Keypoint("nose", 100, 100, 0.95)])[0]
    assert out.detected and not out.estimated and out.confidence == 0.95


def test_prune_remove_tracks_ausentes():
    p = KeypointProcessor()
    k = [Keypoint("nose", 100, 100, 0.9)]
    p.process(1, k)
    p.process(2, k)
    p.prune({1})
    assert 1 in p._filters and 2 not in p._filters


def test_estimated_expira_apos_limite():
    p = KeypointProcessor(max_estimated=3)
    for _ in range(5):
        p.process(1, [Keypoint("nose", 100, 100, 0.9)])
    outs = [p.process(1, [Keypoint("nose", 0, 0, 0.1)])[0] for _ in range(5)]
    assert all(o.estimated for o in outs)
    assert [o.confidence > 0 for o in outs] == [True, True, True, False, False]


def test_filtro_reinicia_apos_buraco_longo():
    p = KeypointProcessor(max_estimated=3)
    for _ in range(5):
        p.process(1, [Keypoint("nose", 100, 100, 0.9)])
    for _ in range(5):
        p.process(1, [Keypoint("nose", 0, 0, 0.1)])
    out = p.process(1, [Keypoint("nose", 400, 300, 0.9)])[0]
    assert (out.x, out.y) == (400, 300) and not out.estimated
