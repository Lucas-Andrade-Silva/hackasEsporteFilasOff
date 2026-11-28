"""Pipeline ponta a ponta: vídeo -> detecções -> TrackingResult + exports."""
from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional

from config.settings import RESULTS_DIR, EXPORT_DIR
from core.schema import TrackingResult
from core.video_processor import probe
from core.hybrid_detector import HybridBallDetector
from core.ball_tracker import build_result


def run_analysis(
    video_path: str | Path,
    sport: str,
    start_frame: int = 0,
    end_frame: Optional[int] = None,
    detector: Optional[HybridBallDetector] = None,
    on_progress: Optional[Callable[[float, str], None]] = None,
    save_outputs: bool = True,
) -> tuple[TrackingResult, dict]:
    """Executa o pipeline completo. Retorna (resultado, stats)."""
    video_path = str(video_path)
    info = probe(video_path)
    if end_frame is None or end_frame > info.frame_count:
        end_frame = info.frame_count
    if start_frame < 0 or start_frame >= end_frame:
        raise ValueError(f"Trecho inválido: [{start_frame}, {end_frame})")

    if detector is None:
        detector = HybridBallDetector(sport=sport)

    if on_progress:
        on_progress(0.0, f"Rastreando bola ({sport}) em "
                         f"{end_frame - start_frame} frames...")
    # Lê o vídeo em streaming: memória não cresce com o tamanho do trecho.
    detections = detector.track_video(
        video_path, start_frame, end_frame, info.fps, info.width, info.height,
        on_progress=(lambda p: on_progress(0.9 * p, "Rastreando bola..."))
        if on_progress else None,
    )
    if not detections:
        raise ValueError("Nenhum frame lido no trecho selecionado.")

    result = build_result(
        detections, start_frame=start_frame, fps=info.fps,
        video_path=video_path, sport=sport,
        width=info.width, height=info.height,
        frame_count=info.frame_count,
        breaks=tuple(getattr(detector, "last_breaks", ())),
    )
    result.meta.update(getattr(detector, "last_stats", {}))
    stats = {**result.stats(), **getattr(detector, "last_stats", {})}

    if save_outputs:
        stem = Path(video_path).stem
        result.to_json(RESULTS_DIR / f"{stem}_{start_frame}_{end_frame}.json")
        result.to_csv(RESULTS_DIR / f"{stem}_{start_frame}_{end_frame}.csv")
        if on_progress:
            on_progress(0.95, "Gravando vídeo anotado...")
        from visualization.video_overlay import write_annotated_video
        write_annotated_video(
            video_path, result,
            EXPORT_DIR / f"{stem}_{start_frame}_{end_frame}_annotated.mp4")

    if on_progress:
        on_progress(1.0, "Concluído.")
    return result, stats
