"""Desenho da trajetória sobre o vídeo e exportação do MP4 anotado."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import cv2
import numpy as np

from core.schema import TrackingResult, SOURCE_INTERPOLATED, SOURCE_INPAINT

# Cor por fonte (BGR)
SOURCE_COLORS = {
    "tracknet": (0, 255, 255),      # amarelo
    "vballnet": (0, 255, 255),      # amarelo (modelo principal)
    "yolo": (0, 200, 0),            # verde
    "color_shape": (255, 160, 0),   # azul-laranja
    "inpaintnet": (200, 0, 200),    # magenta = estimado
    "interpolated": (200, 0, 200),  # magenta = estimado
    "none": (0, 0, 255),
}


def annotate_frame(
    frame: np.ndarray,
    records,
    rec_idx: int,
    trail: deque,
    trail_len: int = 20,
) -> np.ndarray:
    """Desenha bola + trilha + rótulo de fonte/confiança no frame."""
    rec = records[rec_idx]
    d = rec.ball
    if d.visibility and d.x is not None:
        trail.appendleft((int(d.x), int(d.y), d.estimated))
    if len(trail) > trail_len:
        trail.pop()

    # Trilha (detectado = linha cheia, estimado = pontos)
    for k, (tx, ty, est) in enumerate(trail):
        if est:
            cv2.circle(frame, (tx, ty), 2, (200, 0, 200), -1)
        else:
            r = max(1, 4 - k // 6)
            cv2.circle(frame, (tx, ty), r, (0, 255, 255), -1)

    # Bola atual
    if d.visibility and d.x is not None:
        color = SOURCE_COLORS.get(d.source, (0, 255, 255))
        cv2.circle(frame, (int(d.x), int(d.y)), 8, color, 2)
        tag = f"{d.source} {d.confidence:.2f}" + (" [est]" if d.estimated else "")
        cv2.putText(frame, tag, (int(d.x) + 12, int(d.y) - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
    else:
        cv2.putText(frame, "bola nao detectada", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1, cv2.LINE_AA)

    cv2.putText(frame, f"f{rec.frame}  t={rec.timestamp:.2f}s", (10, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1, cv2.LINE_AA)
    return frame


def write_annotated_video(
    video_path: str,
    result: TrackingResult,
    out_path: str | Path,
    trail_len: int = 20,
) -> Path:
    """Regrava o trecho processado com a trajetória sobreposta.

    Grava H.264 (yuv420p, faststart) via ffmpeg do imageio-ffmpeg, que
    toca no navegador/Streamlit. O 'mp4v' do OpenCV não toca em browser;
    fica só como fallback se o ffmpeg não estiver disponível.
    """
    out_path = Path(out_path)
    cap = cv2.VideoCapture(str(video_path))
    if result.processed_start:
        cap.set(cv2.CAP_PROP_POS_FRAMES, result.processed_start)
    size = (result.width, result.height)
    write, close = _open_writer(out_path, size, result.fps)
    trail: deque = deque()
    i = 0
    try:
        while i < len(result.records):
            ok, frame = cap.read()
            if not ok:
                break
            if (frame.shape[1], frame.shape[0]) != size:
                frame = cv2.resize(frame, size)
            write(annotate_frame(frame, result.records, i, trail, trail_len))
            i += 1
    finally:
        close()
        cap.release()
    return out_path


def _open_writer(out_path: Path, size: tuple[int, int], fps: float):
    """(write(frame_bgr), close()) — H.264 se possível, senão mp4v."""
    try:
        import imageio_ffmpeg
        gen = imageio_ffmpeg.write_frames(
            str(out_path), size, fps=fps, codec="libx264",
            pix_fmt_in="bgr24", pix_fmt_out="yuv420p", quality=7,
            macro_block_size=2, output_params=["-movflags", "+faststart"])
        gen.send(None)  # inicia o processo ffmpeg
        return (lambda f: gen.send(np.ascontiguousarray(f))), gen.close
    except Exception:
        writer = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*"mp4v"),
                                 fps, size)
        return writer.write, writer.release
