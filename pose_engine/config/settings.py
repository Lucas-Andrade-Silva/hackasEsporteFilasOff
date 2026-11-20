"""Caminhos e parâmetros do pose_engine."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
VIDEO_DIR = DATA_DIR / "videos"
RESULTS_DIR = DATA_DIR / "results"
EXPORT_DIR = BASE_DIR / "exports"

DETECTION_THRESHOLD = 0.5      # confiança mínima da detecção de pessoa
KEYPOINT_MIN_CONF = 0.5        # abaixo disso o keypoint vira "estimated"
ONE_EURO_MIN_CUTOFF = 1.0      # Hz — suavização em repouso
ONE_EURO_BETA = 0.007          # resposta a movimento rápido
MAX_LOST_FRAMES = 30           # pruning de suavizadores de tracks ausentes

SPORTS = ["volleyball", "basketball"]

for _d in (VIDEO_DIR, RESULTS_DIR, EXPORT_DIR):
    _d.mkdir(parents=True, exist_ok=True)
