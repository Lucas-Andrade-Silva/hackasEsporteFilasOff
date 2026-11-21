"""Leitura de vídeo, metadados e extração de trechos.

Timestamps sempre derivados de frame_index / fps real do arquivo.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional

import cv2
import numpy as np


@dataclass
class VideoInfo:
    path: str
    fps: float
    width: int
    height: int
    frame_count: int
    duration: float
    codec: str


def probe(video_path: str | Path) -> VideoInfo:
    """Extrai metadados do vídeo sem decodificar todos os frames."""
    video_path = str(video_path)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Não foi possível abrir o vídeo: {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
    codec = "".join(chr((fourcc >> 8 * i) & 0xFF) for i in range(4)).strip()
    cap.release()
    return VideoInfo(
        path=video_path, fps=float(fps), width=w, height=h,
        frame_count=n, duration=n / fps if fps else 0.0, codec=codec,
    )


def iter_frames(
    video_path: str | Path,
    start_frame: int = 0,
    end_frame: Optional[int] = None,
    step: int = 1,
) -> Iterator[tuple[int, np.ndarray]]:
    """Itera (frame_index, imagem BGR) dentro do intervalo [start, end).

    Com step > 1, os frames pulados só são "grabbed" (sem conversão de
    cor), o que deixa a amostragem bem mais barata.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Não foi possível abrir o vídeo: {video_path}")
    if start_frame > 0:
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    idx = start_frame
    try:
        while end_frame is None or idx < end_frame:
            if (idx - start_frame) % step:
                if not cap.grab():
                    break
            else:
                ok, frame = cap.read()
                if not ok:
                    break
                yield idx, frame
            idx += 1
    finally:
        cap.release()


def read_segment(
    video_path: str | Path,
    start_frame: int = 0,
    end_frame: Optional[int] = None,
) -> list[np.ndarray]:
    """Lê todos os frames do trecho para memória (lista BGR)."""
    return [f for _, f in iter_frames(video_path, start_frame, end_frame)]


def timestamp_of(frame_index: int, fps: float) -> float:
    return frame_index / fps if fps else 0.0
