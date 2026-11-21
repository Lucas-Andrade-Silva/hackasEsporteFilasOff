"""CLI para rodar o pipeline de pose sem a interface.

Exemplo:
    python pose_engine/run_pipeline.py --video data/videos/volei.mp4 \
        --sport volleyball --start 0 --end 10
"""
import argparse
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config.settings import (EXPORT_DIR, INFERENCE_BATCH,  # noqa: E402
                             INFERENCE_MODE, SPORTS)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--video", required=True)
    p.add_argument("--sport", default="volleyball", choices=SPORTS)
    p.add_argument("--start", type=float, default=0.0, help="segundo inicial")
    p.add_argument("--end", type=float, default=None, help="segundo final")
    p.add_argument("--out", default=str(EXPORT_DIR), help="diretório de saída")
    p.add_argument("--device", default=None, help="'cuda', 'cpu' ou auto")
    p.add_argument("--mode", default=INFERENCE_MODE,
                   choices=["eager", "compile", "none"],
                   help="eager=fp16 sem compilar (padrão); compile=mais "
                        "rápido, ~2 min de compilação; none=predict original")
    p.add_argument("--batch", type=int, default=INFERENCE_BATCH,
                   help="frames por chamada ao modelo")
    p.add_argument("--no-annotate", action="store_true",
                   help="só gera o JSONL, sem vídeo anotado")
    args = p.parse_args()

    from core.athlete_detector import RFDETRPoseEstimator
    from core.pipeline import run
    from core.video_processor import probe

    meta = probe(args.video)
    print(f"{meta.width}x{meta.height} @ {meta.fps:.1f}fps, "
          f"{meta.frame_count} frames ({meta.duration:.1f}s)")

    est = RFDETRPoseEstimator(device=args.device, mode=args.mode,
                              batch_size=args.batch)
    print(f"modelo: modo={est.mode} lote={est.batch_size}")
    last = [-1]

    def progress(frac):
        pct = int(frac * 100)
        if pct // 5 > last[0]:
            last[0] = pct // 5
            print(f"  {pct}%", flush=True)

    res = run(args.video, args.sport, args.out, start_s=args.start,
              end_s=args.end, estimator=est, progress_cb=progress,
              annotate=not args.no_annotate)
    print(f"\n{res['frames']} frames processados")
    print(f"JSONL:  {res['jsonl_path']}")
    if res["video_path"]:
        print(f"Vídeo:  {res['video_path']}")
    print(f"Atletas vistos: {res['athletes_seen']}")


if __name__ == "__main__":
    main()
