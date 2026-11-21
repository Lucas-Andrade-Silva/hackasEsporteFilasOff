"""Leitura de vídeo: metadata e iteração frame a frame com timestamps."""
from __future__ import annotations

from dataclasses import dataclass

import cv2


@dataclass
class VideoMetadata:
    fps: float
    width: int
    height: int
    frame_count: int
    duration: float


def probe(video_path) -> VideoMetadata:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Não foi possível abrir o vídeo: {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    meta = VideoMetadata(
        fps=fps,
        width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        frame_count=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        duration=0.0,
    )
    cap.release()
    meta.duration = meta.frame_count / meta.fps if meta.fps else 0.0
    return meta


def iter_frames(video_path, start_s=0.0, end_s=None):
    """Yields (frame_idx, timestamp_s, frame_bgr) no trecho [start_s, end_s]."""
    meta = probe(video_path)
    first = max(0, int(start_s * meta.fps))
    last = meta.frame_count if end_s is None else min(
        meta.frame_count, int(end_s * meta.fps) + 1)
    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)
    idx = first
    while idx < last:
        ok, frame = cap.read()
        if not ok:
            break
        yield idx, idx / meta.fps, frame
        idx += 1
    cap.release()


def to_browser_mp4(src, dst) -> bool:
    """Reencoda `src` (mp4v do cv2) em H.264/yuv420p tocável no navegador.

    O OpenCV do pip não traz encoder H.264 utilizável no Windows (falta a
    DLL openh264), então usamos o ffmpeg empacotado pelo imageio-ffmpeg.
    Retorna False (e não mexe em `src`) se o ffmpeg não estiver disponível
    ou falhar — quem chama decide manter o mp4v.
    """
    import subprocess
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return False
    cmd = [exe, "-y", "-loglevel", "error", "-i", str(src),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
           "-crf", "23", "-movflags", "+faststart", str(dst)]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=1800)
    except (subprocess.SubprocessError, OSError):
        return False
    return True
