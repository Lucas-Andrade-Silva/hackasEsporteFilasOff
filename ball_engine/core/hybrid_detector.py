"""Detector híbrido: modelo de bola -> filtro de trajetória -> fallback -> InpaintNet.

Ordem dos passos (cada um só atua onde o anterior deixou lacuna):
0. Uma passada de análise: cortes de cena, câmera parada/em movimento e
   fundo mediano por tomada (core.background). Cada tomada é processada
   de forma independente — nada atravessa um corte.
1. Modelo de bola em streaming (VballNet, padrão, ou TrackNetV3): candidatos
   por frame. Vídeo vertical é coberto por recortes 16:9 sobrepostos.
2. Escolha do blob coerente com os vizinhos + remoção de outliers.
3. Fallback YOLO / cor+forma *restrito à trajetória*: busca só numa ROI
   em volta da posição prevista e aceita apenas candidatos dentro do raio
   fisicamente plausível. Sem contexto, só YOLO com confiança alta.
4. InpaintNet (só em tomadas de câmera fixa) nas lacunas internas de até
   MAX_INPAINT_GAP_S, usando também as posições achadas pelo fallback.
(A interpolação curta acontece depois, em ball_tracker.build_result.)
"""
from __future__ import annotations

import logging
import math
from typing import Callable, Iterable, Optional

import numpy as np

from config.settings import (
    TRACKNET_CONF_THRESHOLD, UNGATED_YOLO_CONF, MAX_INPAINT_GAP_S,
    DEFAULT_BALL_MODEL,
)
from config.sports_config import SPORTS
from core.background import Canvas, Shot, analyze_background
from core.schema import Detection, SOURCE_COLOR, SOURCE_TRACKNET, SOURCE_VBALLNET
from core.tracknet_detector import TrackNetV3Detector, InpaintNetModel
from core import vballnet_detector
from core.fallback_detector import YoloBallDetector, ColorShapeDetector, roi_around
from core.trajectory_filter import (
    MotionModel, predict_position, reject_outliers, select_candidates,
)

log = logging.getLogger(__name__)

ProgressFn = Optional[Callable[[float], None]]


def _sub(cb: ProgressFn, a: float, b: float) -> ProgressFn:
    """Mapeia progresso [0,1] de um passo para a faixa [a,b] do total."""
    return (lambda p: cb(a + (b - a) * p)) if cb else None


BALL_MODELS = ("vballnet", "tracknet", "none")


def default_ball_model() -> str:
    """VballNet se os pesos e o onnxruntime existirem; senão TrackNet."""
    if DEFAULT_BALL_MODEL == "vballnet" and not vballnet_detector.available():
        return "tracknet"
    return DEFAULT_BALL_MODEL


class HybridBallDetector:
    """Combina um modelo temporal de bola com detectores por-frame.

    ball_model:
    - "vballnet": VballNet (grade, treinado para vôlei) — padrão.
    - "tracknet": TrackNetV3 (pesos de badminton) com fundo mediano.
    - "none": só fallbacks YOLO / cor+forma.
    """

    def __init__(
        self,
        sport: str,
        use_tracknet: bool = True,
        use_yolo: bool = True,
        use_color: bool = True,
        use_inpaint: bool = True,
        conf_threshold: float = TRACKNET_CONF_THRESHOLD,
        device: Optional[str] = None,
        ball_model: Optional[str] = None,
    ):
        if sport not in SPORTS:
            raise ValueError(f"Esporte desconhecido: {sport}. Use {list(SPORTS)}")
        if ball_model is None:
            ball_model = default_ball_model() if use_tracknet else "none"
        if ball_model not in BALL_MODELS:
            raise ValueError(f"Modelo de bola desconhecido: {ball_model}. Use {BALL_MODELS}")
        self.sport = sport
        self.sport_cfg = SPORTS[sport]
        self.conf_threshold = conf_threshold
        self.ball_model = ball_model
        self.tracknet = (TrackNetV3Detector(device=device, use_inpaint=use_inpaint)
                         if ball_model == "tracknet" else None)
        self.vballnet = (vballnet_detector.VballNetDetector()
                         if ball_model == "vballnet" else None)
        if self.tracknet is not None:
            self.inpainter = self.tracknet.inpainter
        elif self.vballnet is not None and use_inpaint:
            self.inpainter = InpaintNetModel(device=device)
            if self.inpainter.net is None:
                self.inpainter = None
        else:
            self.inpainter = None
        self.yolo = YoloBallDetector() if use_yolo else None
        self.color = ColorShapeDetector(self.sport_cfg) if use_color else None
        self.last_stats: dict = {}
        self.last_breaks: list[int] = []   # inícios de tomada (exceto 0)
        self._yolo_failed = False

    # -- API pública ---------------------------------------------------------

    def track_video(self, video_path, start_frame: int, end_frame: int,
                    fps: float, frame_w: int, frame_h: int,
                    on_progress: ProgressFn = None) -> list[Detection]:
        """Rastreia direto do arquivo, sem carregar o trecho em memória."""
        from core.video_processor import iter_frames
        total = end_frame - start_frame

        def frames(a: int = 0, b: Optional[int] = None) -> Iterable[np.ndarray]:
            b = total if b is None else b
            return (f for _, f in iter_frames(video_path, start_frame + a,
                                              start_frame + b))

        return self._run(frames, total, fps, frame_w, frame_h, on_progress)

    def track(self, frames_bgr: list[np.ndarray], frame_w: int, frame_h: int,
              on_progress: ProgressFn = None, fps: float = 30.0
              ) -> list[Detection]:
        """Mesma coisa a partir de uma lista de frames já em memória."""
        return self._run(lambda a=0, b=None: iter(frames_bgr[a:b]),
                         len(frames_bgr), fps, frame_w, frame_h, on_progress)

    # -- pipeline interno ----------------------------------------------------

    def _run(self, frames: Callable[..., Iterable[np.ndarray]], n_expected: int,
             fps: float, frame_w: int, frame_h: int,
             on_progress: ProgressFn) -> list[Detection]:
        motion = MotionModel.from_sport(
            frame_w, frame_h, fps, self.sport_cfg["max_speed_diag_s"])
        stats = {"outliers_removidos": 0, "fallback_aceitos": 0,
                 "fallback_rejeitados_fora_da_trajetoria": 0}
        max_gap = max(1, int(round((fps or 30.0) * MAX_INPAINT_GAP_S)))
        canvas = Canvas(frame_w, frame_h)

        bg = None
        if self.ball_model != "none":
            bg = analyze_background((canvas.make(f) for f in frames()), fps)
            if bg is None:
                return []
            shots = bg.shots
        else:
            shots = [Shot(0, n_expected, False)]
        if on_progress:
            on_progress(0.1)

        n_total = max(1, shots[-1].end)
        dets_all: list[Detection] = []
        for shot in shots:
            a, b = shot.start, shot.end
            n = b - a
            p0 = 0.1 + 0.9 * a / n_total
            span = 0.9 * n / n_total
            sub = lambda x, y: _sub(on_progress, p0 + span * x, p0 + span * y)  # noqa: E731

            dets: Optional[list[Detection]] = None
            if self.tracknet is not None:
                cands = self.tracknet.candidates(
                    frames(a, b), canvas, lambda f, o=a: bg.median_for(o + f),
                    n_expected=n, on_progress=sub(0.0, 0.65))
            elif self.vballnet is not None:
                cands = self.vballnet.candidates(
                    frames(a, b), frame_w, frame_h, n_expected=n,
                    on_progress=sub(0.0, 0.65))
            if self.ball_model != "none":
                src = SOURCE_VBALLNET if self.vballnet is not None else SOURCE_TRACKNET
                dets = select_candidates(cands, motion, source=src)
                dets, removed = reject_outliers(dets, motion)
                stats["outliers_removidos"] += removed

            if self.yolo is not None or self.color is not None:
                dets = self._fallback(lambda a=a, b=b: frames(a, b), dets, motion,
                                      frame_w, frame_h, n, stats, sub(0.65, 0.95))
            elif dets is None:
                dets = [Detection() for _ in frames(a, b)]

            # InpaintNet trabalha em coordenadas de imagem: com a câmera se
            # movendo, a trajetória na tela não é a da bola e ele inventa
            # pontos (praia: 147 frames, quase todos errados). Só câmera fixa.
            if self.inpainter is not None and not shot.moving:
                dets = self.inpainter.inpaint(dets, frame_w, frame_h,
                                              on_progress=sub(0.95, 1.0),
                                              max_gap=max_gap)
            dets_all += dets

        if on_progress:
            on_progress(1.0)
        stats["tomadas"] = [{"inicio": s.start, "fim": s.end,
                             "camera_movel": s.moving} for s in shots]
        stats["modelo_bola"] = (self.vballnet.name if self.vballnet is not None
                                else self.ball_model)
        stats["recortes"] = len(
            self.vballnet.canvas(frame_w, frame_h).tiles if self.vballnet is not None
            else canvas.tiles)
        self.last_stats = stats
        self.last_breaks = [s.start for s in shots[1:]]
        return dets_all

    def _fallback(self, frames, dets, motion: MotionModel, frame_w: int,
                  frame_h: int, n_expected: int, stats: dict,
                  on_progress: ProgressFn) -> list[Detection]:
        """Percorre o vídeo de novo e tenta os fallbacks só nas lacunas.

        Em ordem temporal: uma posição aceita aqui já serve de contexto
        para prever o frame seguinte.
        """
        build = dets is None
        dets = [] if build else dets
        # Contexto para prever posições: TrackNet + YOLO. Cor+forma é a
        # fonte mais fraca e não serve de âncora (evita erro em cascata).
        anchors = [d if d.source != SOURCE_COLOR else Detection() for d in dets]
        for i, frame in enumerate(frames()):
            if build:
                dets.append(Detection())
                anchors.append(Detection())
            if i >= len(dets):
                break
            d = dets[i]
            if not (d.detected and d.confidence >= self.conf_threshold):
                cand = self._fallback_frame(frame, anchors, i, motion,
                                            frame_w, frame_h, stats)
                if cand is not None:
                    dets[i] = cand
                    if cand.source != SOURCE_COLOR:
                        anchors[i] = cand
                    stats["fallback_aceitos"] += 1
            if on_progress and n_expected:
                on_progress(min(1.0, (i + 1) / n_expected))
        return dets

    def _yolo_all(self, frame, roi=None, conf=None) -> list[Detection]:
        if self.yolo is None or self._yolo_failed:
            return []
        try:
            return self.yolo.detect_all(frame, roi=roi, conf=conf)
        except Exception:
            # Não derruba a análise, mas não falha em silêncio.
            log.exception("YOLO falhou; seguindo só com cor+forma.")
            self._yolo_failed = True
            return []

    def _fallback_frame(self, frame, dets, i, motion, frame_w, frame_h,
                        stats) -> Optional[Detection]:
        pred = predict_position(dets, i, motion)
        if pred is None:
            # Sem trajetória para guiar: só YOLO confiante, frame inteiro.
            cands = [c for c in self._yolo_all(frame, conf=UNGATED_YOLO_CONF)
                     if c.confidence >= UNGATED_YOLO_CONF]
            if not cands and self.ball_model == "none" and self.color is not None:
                # Modo sem TrackNet: mantém o comportamento antigo.
                cands = self.color.detect_all(frame)
            return max(cands, key=lambda c: c.confidence) if cands else None

        px, py = pred.x, pred.y
        dist = lambda c: math.hypot(c.x - px, c.y - py)  # noqa: E731

        # YOLO: ROI do tamanho do raio plausível.
        roi = roi_around(px, py, pred.radius, frame_w, frame_h)
        cands = self._yolo_all(frame, roi=roi)
        inside = [c for c in cands if dist(c) <= pred.radius]
        stats["fallback_rejeitados_fora_da_trajetoria"] += len(cands) - len(inside)
        if inside:
            return min(inside, key=dist)

        # Cor+forma: só com contexto dos dois lados e raio apertado — a
        # heurística acha muito objeto parecido (camisa, linha, céu).
        if self.color is None or not pred.two_sided:
            return None
        r = motion.margin + 0.5 * motion.max_step * pred.dt
        cands = self.color.detect_all(
            frame, roi=roi_around(px, py, r, frame_w, frame_h))
        inside = [c for c in cands if dist(c) <= r]
        stats["fallback_rejeitados_fora_da_trajetoria"] += len(cands) - len(inside)
        return min(inside, key=dist) if inside else None
