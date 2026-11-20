"""Adaptador do TrackNetV3 (qaz812345/TrackNetV3) para o pipeline.

Implementa o mesmo fluxo do predict.py original:
- entrada: janela de seq_len frames RGB 512x288 + fundo mediano (bg_mode do ckpt)
- saída: heatmap sigmoide -> contornos -> maior blob -> centro
- ensemble temporal com peso posicional (eval_mode='weight')
- InpaintNet para preencher lacunas marcadas pela máscara de trajetória

Funções utilitárias portadas de test.py/utils do repositório original
(predict_location, get_ensemble_weight, generate_inpaint_mask).
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable, Optional

import cv2
import math
import numpy as np
import torch

from config.settings import (
    TRACKNET_REPO_DIR, TRACKNET_CKPT, INPAINTNET_CKPT,
    TRACKNET_HEIGHT, TRACKNET_WIDTH, MEDIAN_SAMPLE_MAX,
)
from core.schema import Detection, SOURCE_TRACKNET, SOURCE_INPAINT

# Importa model.py do repositório vendored
if str(TRACKNET_REPO_DIR) not in sys.path:
    sys.path.insert(0, str(TRACKNET_REPO_DIR))
from model import TrackNet, InpaintNet  # noqa: E402

H, W = TRACKNET_HEIGHT, TRACKNET_WIDTH
COOR_TH = (1 / math.sqrt(H ** 2 + W ** 2)) * 50  # mesmo COOR_TH do repo


# ---- utilitários portados de test.py -------------------------------------

def predict_location(heatmap: np.ndarray) -> tuple[int, int, int, int]:
    """(x, y, w, h) do maior blob do heatmap binário."""
    if np.amax(heatmap) == 0:
        return 0, 0, 0, 0
    cnts, _ = cv2.findContours(heatmap.copy(), cv2.RETR_EXTERNAL,
                               cv2.CHAIN_APPROX_SIMPLE)
    rects = [cv2.boundingRect(c) for c in cnts]
    i = max(range(len(rects)), key=lambda k: rects[k][2] * rects[k][3])
    return rects[i]


def get_ensemble_weight(seq_len: int) -> torch.Tensor:
    """Peso posicional triangular (eval_mode='weight' do repo original)."""
    weight = torch.ones(seq_len)
    for i in range(math.ceil(seq_len / 2)):
        weight[i] = i + 1
        weight[seq_len - i - 1] = i + 1
    return weight / weight.sum()


def generate_inpaint_mask(xs, ys, vis, th_h: float) -> np.ndarray:
    """Máscara de lacunas internas da trajetória (portado de test.py)."""
    y = np.asarray(ys, dtype=float)
    vis_pred = np.asarray(vis)
    mask = np.zeros_like(y)
    i = j = 0
    n = len(vis_pred)
    while j < n:
        while i < n - 1 and vis_pred[i] == 1:
            i += 1
        j = i
        while j < n - 1 and vis_pred[j] == 0:
            j += 1
        if j == i:
            break
        if i == 0 and y[j] > th_h:
            mask[:j] = 1
        elif (i > 1 and y[i - 1] > th_h) and (j < n and y[j] > th_h):
            mask[i:j] = 1
        i = j
    return mask


# ---- detector -------------------------------------------------------------

class TrackNetV3Detector:
    """Rastreador de bola baseado em TrackNetV3 + InpaintNet.

    Uso:
        det = TrackNetV3Detector()
        detections = det.track(frames_bgr, frame_w, frame_h, on_progress=cb)
    Retorna list[Detection] com uma entrada por frame de entrada.
    """

    def __init__(
        self,
        tracknet_ckpt: str | Path = TRACKNET_CKPT,
        inpaintnet_ckpt: str | Path | None = INPAINTNET_CKPT,
        device: Optional[str] = None,
        use_inpaint: bool = True,
    ):
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device)

        ckpt = torch.load(str(tracknet_ckpt), map_location=self.device,
                          weights_only=False)
        p = ckpt["param_dict"]
        self.seq_len = p["seq_len"]
        self.bg_mode = p["bg_mode"]
        in_dim = {
            "": self.seq_len * 3,
            "subtract": self.seq_len,
            "subtract_concat": self.seq_len * 4,
            "concat": (self.seq_len + 1) * 3,
        }[self.bg_mode]
        self.tracknet = TrackNet(in_dim=in_dim, out_dim=self.seq_len)
        self.tracknet.load_state_dict(ckpt["model"])
        self.tracknet.to(self.device).eval()

        self.inpaintnet = None
        if use_inpaint and inpaintnet_ckpt and Path(inpaintnet_ckpt).exists():
            ckpt_i = torch.load(str(inpaintnet_ckpt), map_location=self.device,
                                weights_only=False)
            self.inpaint_seq_len = ckpt_i["param_dict"]["seq_len"]
            self.inpaintnet = InpaintNet()
            self.inpaintnet.load_state_dict(ckpt_i["model"])
            self.inpaintnet.to(self.device).eval()

    # -- preprocessamento ---------------------------------------------------

    def _median_bg(self, frames_rgb: list[np.ndarray]) -> np.ndarray:
        """Fundo mediano (H, W, 3) uint8 já no tamanho do modelo."""
        n = len(frames_rgb)
        step = max(1, n // MEDIAN_SAMPLE_MAX)
        sample = np.stack(frames_rgb[::step])
        med = np.median(sample, axis=0).astype("uint8")
        return cv2.resize(med, (W, H))

    def _build_input(self, frames_rgb: list[np.ndarray],
                     median_small: np.ndarray) -> np.ndarray:
        """Monta tensor de entrada (C, H, W) float32 para uma janela."""
        seq = np.stack([
            np.moveaxis(cv2.resize(f, (W, H)), -1, 0)
            for f in frames_rgb
        ])  # (L, 3, H, W)
        median_ch = np.moveaxis(median_small, -1, 0)  # (3, H, W)

        if self.bg_mode == "subtract":
            diff = np.abs(seq.astype(np.int16) - median_ch[None].astype(np.int16))
            x = diff.sum(axis=2).astype(np.uint8)  # (L, H, W)
        elif self.bg_mode == "subtract_concat":
            diff = np.abs(seq.astype(np.int16) - median_ch[None].astype(np.int16))
            diff = diff.sum(axis=2, keepdims=True).astype(np.uint8)
            x = np.concatenate([seq, diff], axis=1).reshape(-1, H, W)
        elif self.bg_mode == "concat":
            x = np.concatenate([median_ch[None], seq], axis=0).reshape(-1, H, W)
        else:
            x = seq.reshape(-1, H, W)
        return x.astype(np.float32) / 255.0

    # -- inferência ----------------------------------------------------------

    @torch.no_grad()
    def track(
        self,
        frames_bgr: list[np.ndarray],
        frame_w: int,
        frame_h: int,
        on_progress: Optional[Callable[[float], None]] = None,
        batch_size: int = 8,
    ) -> list[Detection]:
        """Rastreia a bola em toda a sequência. Um Detection por frame."""
        n = len(frames_bgr)
        if n == 0:
            return []
        frames_rgb = [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) for f in frames_bgr]
        median_small = self._median_bg(frames_rgb)

        # Ensemble temporal: cada frame acumula a saída de todas as janelas
        # que o contêm, ponderada pela posição dentro da janela.
        L = self.seq_len
        weight = get_ensemble_weight(L).numpy()
        acc = np.zeros((n, H, W), dtype=np.float32)
        wsum = np.zeros(n, dtype=np.float32)

        windows = []
        for i in range(n):
            valid = min(L, n - i)
            clip = frames_rgb[i:i + valid]
            if valid < L:  # repete último frame só p/ completar a janela
                clip = clip + [frames_rgb[n - 1]] * (L - valid)
            windows.append((i, valid, self._build_input(clip, median_small)))

        for b in range(0, n, batch_size):
            batch = windows[b:b + batch_size]
            x = torch.from_numpy(np.stack([t[2] for t in batch])).to(self.device)
            y = self.tracknet(x).cpu().numpy()  # (B, L, H, W)
            for k, (i, valid, _) in enumerate(batch):
                for f in range(valid):
                    acc[i + f] += y[k, f] * weight[f]
                    wsum[i + f] += weight[f]
            if on_progress:
                on_progress(0.7 * min(1.0, (b + batch_size) / n))

        wsum[wsum == 0] = 1.0
        heatmaps = acc / wsum[:, None, None]

        # Heatmap -> (x, y, conf) em coordenadas do frame original
        sx, sy = frame_w / W, frame_h / H
        xs, ys, confs, vis = [], [], [], []
        for f in range(n):
            hm = heatmaps[f]
            peak = float(hm.max())
            bx, by, bw, bh = predict_location((hm > 0.5).astype(np.uint8))
            if bw > 0:
                xs.append((bx + bw / 2) * sx)
                ys.append((by + bh / 2) * sy)
                confs.append(peak)
                vis.append(1)
            else:
                xs.append(0.0)
                ys.append(0.0)
                confs.append(peak)
                vis.append(0)
            if on_progress:
                on_progress(0.7 + 0.1 * f / n)

        detections = [
            Detection(x=x if v else None, y=y if v else None,
                      confidence=c, visibility=bool(v), source=SOURCE_TRACKNET)
            for x, y, c, v in zip(xs, ys, confs, vis)
        ]

        if self.inpaintnet is not None:
            detections = self._inpaint(detections, xs, ys, vis,
                                       frame_w, frame_h, on_progress)
        return detections

    @torch.no_grad()
    def _inpaint(self, detections, xs, ys, vis, frame_w, frame_h,
                 on_progress=None) -> list[Detection]:
        """Preenche lacunas internas da trajetória com InpaintNet."""
        n = len(detections)
        L = self.inpaint_seq_len
        mask = generate_inpaint_mask(xs, ys, vis, th_h=frame_h * 0.05)
        if mask.sum() == 0 or n < L:
            return detections

        coor = np.stack([np.asarray(xs) / frame_w,
                         np.asarray(ys) / frame_h], axis=1).astype(np.float32)
        m = mask.reshape(-1, 1).astype(np.float32)

        weight = get_ensemble_weight(L).numpy()
        acc = np.zeros((n, 2), dtype=np.float32)
        wsum = np.zeros(n, dtype=np.float32)

        for i in range(n):
            valid = min(L, n - i)
            c = coor[i:i + valid]
            mm = m[i:i + valid]
            if valid < L:  # repete última posição
                c = np.concatenate([c, np.repeat(c[-1:], L - valid, axis=0)])
                mm = np.concatenate([mm, np.repeat(mm[-1:], L - valid, axis=0)])
            xc = torch.from_numpy(c[None]).to(self.device)
            xm = torch.from_numpy(mm[None]).to(self.device)
            out = self.inpaintnet(xc, xm).cpu().numpy()[0]  # (L, 2)
            out = out * mm[:, 0][:, None] + c * (1 - mm[:, 0][:, None])
            for f in range(valid):
                acc[i + f] += out[f] * weight[f]
                wsum[i + f] += weight[f]
            if on_progress:
                on_progress(0.8 + 0.2 * i / n)

        wsum[wsum == 0] = 1.0
        repaired = acc / wsum[:, None]
        repaired[(repaired[:, 0] < COOR_TH) & (repaired[:, 1] < COOR_TH)] = 0.0

        for f in range(n):
            if mask[f] == 1 and repaired[f, 0] > 0 and repaired[f, 1] > 0:
                detections[f] = Detection(
                    x=float(repaired[f, 0] * frame_w),
                    y=float(repaired[f, 1] * frame_h),
                    confidence=0.5, visibility=True, source=SOURCE_INPAINT,
                )
        return detections
