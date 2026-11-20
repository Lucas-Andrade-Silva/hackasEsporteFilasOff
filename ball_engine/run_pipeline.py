"""CLI para validar o pipeline sem a interface.

Exemplo:
    python run_pipeline.py --video data/videos/volei.mp4 --sport volleyball \
        --start 0 --end 5
"""
import argparse
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from core.pipeline import run_analysis  # noqa: E402


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--video", required=True)
    p.add_argument("--sport", default="volleyball",
                 choices=["volleyball", "basketball"])
    p.add_argument("--start", type=float, default=0.0, help="segundo inicial")
    p.add_argument("--end", type=float, default=None, help="segundo final")
    p.add_argument("--no-tracknet", action="store_true")
    p.add_argument("--no-yolo", action="store_true")
    p.add_argument("--no-color", action="store_true")
    args = p.parse_args()

    from core.video_processor import probe
    from core.hybrid_detector import HybridBallDetector

    info = probe(args.video)
    start_frame = int(args.start * info.fps)
    end_frame = int(args.end * info.fps) if args.end else None

    detector = HybridBallDetector(
        sport=args.sport,
        use_tracknet=not args.no_tracknet,
        use_yolo=not args.no_yolo,
        use_color=not args.no_color)

    result, stats = run_analysis(
        args.video, args.sport, start_frame, end_frame, detector=detector,
        on_progress=lambda p, m: print(f"\r{p*100:5.1f}% {m}", end="", flush=True))
    print()
    print("=== Stats ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
