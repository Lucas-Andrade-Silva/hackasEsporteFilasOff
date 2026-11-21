"""Pipeline ponta-a-ponta: vídeo -> pose -> tracking -> suavização -> saídas.

Saídas por execução:
  <out_dir>/<stem>_annotated.mp4  vídeo com esqueleto + bbox + id (H.264
                                  quando há ffmpeg; senão mp4v)
  <out_dir>/<stem>.jsonl          1 FrameResult.to_dict() por linha
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import cv2

from config.keypoints import COCO_KEYPOINTS
from config.settings import EXPORT_DIR, MAX_LOST_FRAMES
from core.keypoint_processor import KeypointProcessor
from core.schema import FrameResult, Keypoint, TrackedAthlete
from core.video_processor import iter_frames, probe, to_browser_mp4
from visualization.skeleton_overlay import draw_frame

log = logging.getLogger(__name__)


def _to_keypoints(det) -> list:
    return [Keypoint(COCO_KEYPOINTS[i], float(det.xy[i, 0]),
                     float(det.xy[i, 1]), float(det.conf[i]))
            for i in range(len(COCO_KEYPOINTS))]


def _batches(frames, size: int):
    """Agrupa (idx, ts, frame) em listas de até `size` itens."""
    buf = []
    for item in frames:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def _predict_batch(estimator, imgs: list) -> list:
    fn = getattr(estimator, "predict_batch", None)
    if fn is not None:
        return fn(imgs)
    return [estimator.predict(f) for f in imgs]


def run(video_path, sport: str, out_dir=None, start_s: float = 0.0,
        end_s: float | None = None, estimator=None, tracker=None,
        keypoint_processor=None, progress_cb=None,
        annotate: bool = True) -> dict:
    video_path = Path(video_path)
    out_dir = Path(out_dir) if out_dir else EXPORT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    meta = probe(video_path)
    log.info("vídeo: %s | %.1f fps %dx%d %d frames",
             video_path.name, meta.fps, meta.width, meta.height,
             meta.frame_count)

    if estimator is None:
        from core.athlete_detector import RFDETRPoseEstimator
        estimator = RFDETRPoseEstimator()
    if tracker is None:
        from core.athlete_tracker import ByteTrackTracker
        tracker = ByteTrackTracker(frame_rate=meta.fps)
    smoother = keypoint_processor or KeypointProcessor(dt=1.0 / meta.fps)

    jsonl_path = out_dir / f"{video_path.stem}.jsonl"
    video_out = out_dir / f"{video_path.stem}_annotated.mp4"
    raw_out = out_dir / f"{video_path.stem}_annotated.raw.mp4"
    writer = (cv2.VideoWriter(str(raw_out),
                              cv2.VideoWriter_fourcc(*"mp4v"), meta.fps,
                              (meta.width, meta.height))
          if annotate else None)

    first = int(start_s * meta.fps)
    total = (meta.frame_count if end_s is None
             else min(meta.frame_count, int(end_s * meta.fps) + 1)) - first
    total = max(total, 1)
    batch = max(1, int(getattr(estimator, "batch_size", 1)))

    last_seen: dict[int, int] = {}
    frames_done = 0
    with jsonl_path.open("w", encoding="utf-8") as fj:
        for chunk in _batches(iter_frames(video_path, start_s, end_s), batch):
            all_dets = _predict_batch(estimator, [f for _, _, f in chunk])
            for (idx, ts, frame), dets in zip(chunk, all_dets):
                athletes = []
                for tid, det in tracker.update(dets):
                    pose = smoother.process(tid, _to_keypoints(det))
                    athletes.append(TrackedAthlete(
                        track_id=tid, bbox=tuple(float(v) for v in det.bbox),
                        bbox_confidence=det.bbox_conf, pose=pose))
                    last_seen[tid] = idx

                rec = FrameResult(frame=idx, timestamp=ts, sport=sport,
                                  athletes=athletes)
                fj.write(json.dumps(rec.to_dict()) + "\n")
                if writer is not None:
                    writer.write(draw_frame(frame, athletes))

                frames_done += 1
                if progress_cb:
                    progress_cb(frames_done / total)

                ativos = {t for t, l in last_seen.items()
                          if idx - l <= MAX_LOST_FRAMES}
                smoother.prune(ativos)

    if writer is not None:
        writer.release()
        if to_browser_mp4(raw_out, video_out):
            raw_out.unlink(missing_ok=True)
        else:
            log.warning("ffmpeg indisponível: MP4 fica em mp4v (pode não "
                        "tocar no navegador)")
            raw_out.replace(video_out)
    log.info("fim: %d frames -> %s", frames_done, jsonl_path.name)
    return {"jsonl_path": jsonl_path,
            "video_path": video_out if annotate else None,
            "frames": frames_done,
            "athletes_seen": sorted(set(last_seen))}
