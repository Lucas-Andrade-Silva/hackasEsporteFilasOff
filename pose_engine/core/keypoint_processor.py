"""Suavização temporal dos keypoints (One Euro Filter) e flag `estimated`.

Regra por keypoint (spec: diferenciar detectado de estimado):
- conf >= KEYPOINT_MIN_CONF  -> posição filtrada, estimated=False
- conf <  min e com histórico -> posição do estado do filtro, estimated=True,
                                 por no máximo MAX_ESTIMATED_FRAMES seguidos
- conf <  min sem histórico ou oculto há mais tempo
                              -> estimated=True e confidence=0 (não entra em contas)
Ao reaparecer depois de um buraco maior que o limite, o filtro reinicia
(evita arrastar o ponto a partir de uma posição velha).
"""
from __future__ import annotations

import math

from config.settings import (KEYPOINT_MIN_CONF, MAX_ESTIMATED_FRAMES,
                             ONE_EURO_BETA, ONE_EURO_MIN_CUTOFF)
from core.schema import Keypoint

MIN_UPDATES = 2  # histórico mínimo para usar a estimativa do filtro


def _alpha(cutoff: float, dt: float) -> float:
    tau = 1.0 / (2.0 * math.pi * cutoff)
    return 1.0 / (1.0 + tau / dt)


class OneEuroFilter:
    """Filtro One Euro: suaviza em repouso, responde rápido em movimento.

    Implementação canônica: a derivada usa a última entrada crua (x_prev)
    e o estado suavizado fica em y_prev. cutoff adaptativo =
    min_cutoff + beta * |velocidade filtrada|.
    """

    def __init__(self, min_cutoff: float = ONE_EURO_MIN_CUTOFF,
                 beta: float = ONE_EURO_BETA, d_cutoff: float = 1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self.x_prev = None   # última entrada crua (base da derivada)
        self.y_prev = None   # estado suavizado
        self.dx_prev = 0.0   # derivada suavizada
        self.updates = 0

    @property
    def value(self):
        return self.y_prev

    def __call__(self, x: float, dt: float) -> float:
        if self.y_prev is None:
            self.x_prev, self.y_prev, self.updates = x, x, 1
            return x
        dx = (x - self.x_prev) / dt
        a_d = _alpha(self.d_cutoff, dt)
        self.dx_prev += a_d * (dx - self.dx_prev)
        cutoff = self.min_cutoff + self.beta * abs(self.dx_prev)
        self.y_prev += _alpha(cutoff, dt) * (x - self.y_prev)
        self.x_prev = x
        self.updates += 1
        return self.y_prev


class _OneEuro2D:
    def __init__(self, **kw):
        self.fx = OneEuroFilter(**kw)
        self.fy = OneEuroFilter(**kw)
        self.missing = 0   # frames seguidos sem detecção confiável

    @property
    def updates(self) -> int:
        return self.fx.updates

    @property
    def value(self):
        return self.fx.value, self.fy.value

    def __call__(self, x: float, y: float, dt: float):
        return self.fx(x, dt), self.fy(y, dt)


class KeypointProcessor:
    """Um _OneEuro2D por (track_id, keypoint)."""

    def __init__(self, min_conf: float = KEYPOINT_MIN_CONF,
                 min_cutoff: float = ONE_EURO_MIN_CUTOFF,
                 beta: float = ONE_EURO_BETA, dt: float = 1 / 30,
                 max_estimated: int = MAX_ESTIMATED_FRAMES):
        self.min_conf = min_conf
        self.max_estimated = max_estimated
        self.dt = dt
        self._kw = {"min_cutoff": min_cutoff, "beta": beta}
        self._filters: dict[int, dict[str, _OneEuro2D]] = {}

    def process(self, track_id: int, kpts: list) -> list:
        track = self._filters.setdefault(track_id, {})
        out = []
        for k in kpts:
            f = track.get(k.name)
            if f is None or (k.confidence >= self.min_conf
                             and f.missing > self.max_estimated):
                f = track[k.name] = _OneEuro2D(**self._kw)
            if k.confidence >= self.min_conf:
                f.missing = 0
                x, y = f(k.x, k.y, self.dt)
                out.append(Keypoint(k.name, x, y, k.confidence,
                                    estimated=False))
                continue
            f.missing += 1
            if f.updates >= MIN_UPDATES and f.missing <= self.max_estimated:
                x, y = f.value
                out.append(Keypoint(k.name, x, y, k.confidence,
                                    estimated=True))
            else:
                out.append(Keypoint(k.name, k.x, k.y, 0.0,
                                    estimated=True))
        return out

    def prune(self, active_ids: set) -> None:
        """Remove suavizadores de tracks fora do conjunto ativo."""
        for tid in list(self._filters):
            if tid not in active_ids:
                del self._filters[tid]
