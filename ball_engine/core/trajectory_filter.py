"""Coerência temporal da trajetória.

- `select_candidates`: entre os blobs do TrackNet em cada frame, escolhe
  o mais coerente com os vizinhos (não simplesmente o maior).
- `reject_outliers`: remove posições que exigiriam velocidade impossível
  em relação aos dois vizinhos (falsos positivos isolados).
- `predict_position`: posição esperada + raio de busca num frame sem
  detecção, usado para restringir os fallbacks.

Velocidade máxima é expressa em "diagonais do frame por segundo", para
não depender de resolução nem de fps.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from core.schema import Detection, SOURCE_TRACKNET


@dataclass
class MotionModel:
    """Limites físicos de movimento em pixels/frame."""
    max_step: float     # deslocamento máximo por frame (px)
    margin: float       # folga fixa (px) — ruído de detecção
    max_radius: float   # teto do raio de busca (px)
    context: int = 8    # frames olhados para cada lado

    @classmethod
    def from_sport(cls, frame_w: int, frame_h: int, fps: float,
                   max_speed_diag_s: float, margin_diag: float = 0.02,
                   max_radius_diag: float = 0.25, context: int = 8):
        diag = math.hypot(frame_w, frame_h)
        fps = fps or 30.0
        return cls(max_step=max_speed_diag_s * diag / fps,
                   margin=margin_diag * diag,
                   max_radius=max_radius_diag * diag,
                   context=context)

    def allowed(self, dt: int) -> float:
        """Distância máxima plausível depois de dt frames."""
        return min(self.margin + self.max_step * dt, self.max_radius)


@dataclass
class Prediction:
    x: float
    y: float
    radius: float      # raio de busca plausível (px)
    two_sided: bool    # contexto antes E depois do frame
    dt: int            # distância (frames) até o contexto mais próximo


def _dist(ax, ay, bx, by) -> float:
    return math.hypot(ax - bx, ay - by)


def _neighbors(dets: list[Detection], i: int, k: int):
    """Índices dos detectados mais próximos antes/depois de i (até k frames)."""
    prev = next((j for j in range(i - 1, max(-1, i - k - 1), -1)
                 if dets[j].detected), None)
    nxt = next((j for j in range(i + 1, min(len(dets), i + k + 1))
                if dets[j].detected), None)
    return prev, nxt


def predict_position(dets: list[Detection], i: int, motion: MotionModel
                     ) -> Optional[Prediction]:
    """Posição esperada no frame i, ou None sem contexto.

    - vizinhos dos dois lados: interpolação linear (two_sided=True);
    - só um lado com 2 pontos: extrapolação a velocidade constante;
    - um único vizinho: a própria posição dele.
    O raio cresce com a distância (em frames) até o contexto usado.
    """
    p, q = _neighbors(dets, i, motion.context)
    if p is not None and q is not None:
        t = (i - p) / (q - p)
        x = dets[p].x + (dets[q].x - dets[p].x) * t
        y = dets[p].y + (dets[q].y - dets[p].y) * t
        dt = min(i - p, q - i)
        return Prediction(x, y, motion.allowed(dt), True, dt)
    for nb in (p, q):
        if nb is None:
            continue
        dt = abs(i - nb)
        pp, qq = _neighbors(dets, nb, motion.context)
        second = pp if nb == p else qq   # 2º ponto do mesmo lado
        if second is not None:
            vx = (dets[nb].x - dets[second].x) / (nb - second)
            vy = (dets[nb].y - dets[second].y) / (nb - second)
            step = i - nb
            return Prediction(dets[nb].x + vx * step, dets[nb].y + vy * step,
                              motion.allowed(dt), False, dt)
        return Prediction(dets[nb].x, dets[nb].y, motion.allowed(dt), False, dt)
    return None


def select_candidates(cands_per_frame: list[list], motion: MotionModel,
                      source: str = SOURCE_TRACKNET) -> list[Detection]:
    """Escolhe um blob por frame.

    1ª passada: frames com um único blob são âncoras; nos ambíguos, fica
    provisoriamente o de maior massa.
    2ª passada: nos frames ambíguos, troca pelo blob mais próximo da
    posição prevista pelas âncoras vizinhas (se houver contexto).
    """
    dets: list[Detection] = []
    ambiguous: list[int] = []
    for i, cands in enumerate(cands_per_frame):
        if not cands:
            dets.append(Detection())
            continue
        c = cands[0]
        dets.append(Detection(x=c.x, y=c.y, confidence=c.peak,
                              visibility=True, source=source))
        if len(cands) > 1:
            ambiguous.append(i)

    if not ambiguous:
        return dets
    anchors = [d if (len(cands_per_frame[i]) == 1) else Detection()
               for i, d in enumerate(dets)]
    for i in ambiguous:
        pred = predict_position(anchors, i, motion)
        if pred is None:
            continue
        px, py = pred.x, pred.y
        c = min(cands_per_frame[i], key=lambda c: _dist(c.x, c.y, px, py))
        dets[i] = Detection(x=c.x, y=c.y, confidence=c.peak,
                            visibility=True, source=source)
    return dets


def reject_outliers(dets: list[Detection], motion: MotionModel,
                    max_passes: int = 3) -> tuple[list[Detection], int]:
    """Remove detecções fisicamente incoerentes. Retorna (dets, n_removidos).

    Uma detecção é outlier quando:
    - tem vizinhos dos dois lados, ambos incompatíveis com ela, mas
      compatíveis entre si (o "pico" é ela, não eles); ou
    - tem um único vizinho, incompatível, e o vizinho tem um segundo
      vizinho que confirma a trajetória dele.
    Remoções viram lacuna (fallback/inpaint tentam de novo depois).
    """
    dets = list(dets)
    removed = 0

    def ok(a: int, b: int) -> bool:
        return _dist(dets[a].x, dets[a].y, dets[b].x, dets[b].y) \
            <= motion.allowed(abs(b - a))

    for _ in range(max_passes):
        bad = []
        for i, d in enumerate(dets):
            if not d.detected:
                continue
            p, q = _neighbors(dets, i, motion.context)
            if p is not None and q is not None:
                if not ok(i, p) and not ok(i, q) and ok(p, q):
                    bad.append(i)
            elif p is not None or q is not None:
                nb = p if p is not None else q
                if ok(i, nb):
                    continue
                pp, qq = _neighbors(dets, nb, motion.context)
                second = qq if nb == q else pp
                if second is not None and second != i and ok(nb, second):
                    bad.append(i)
        if not bad:
            break
        for i in bad:
            dets[i] = Detection(confidence=dets[i].confidence)
        removed += len(bad)
    return dets, removed
