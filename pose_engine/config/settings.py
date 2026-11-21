"""Caminhos e parâmetros do pose_engine."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
VIDEO_DIR = DATA_DIR / "videos"
RESULTS_DIR = DATA_DIR / "results"
EXPORT_DIR = BASE_DIR / "exports"

# Detector devolve detecções a partir de DETECTION_THRESHOLD; o ByteTrack
# separa alta (>= TRACK_HIGH_CONF) e baixa confiança. As de baixa só
# continuam tracks já existentes (oclusão parcial), nunca criam ID novo.
DETECTION_THRESHOLD = 0.25     # confiança mínima entregue pelo detector
TRACK_HIGH_CONF = 0.6          # 1ª etapa do ByteTrack / cria tracks
TRACK_ACTIVATION = 0.6         # confiança mínima para nascer um track
KEYPOINT_MIN_CONF = 0.5        # abaixo disso o keypoint vira "estimated"
ONE_EURO_MIN_CUTOFF = 1.0      # Hz — suavização em repouso
ONE_EURO_BETA = 0.007          # resposta a movimento rápido
MAX_LOST_FRAMES = 30           # pruning de suavizadores de tracks ausentes
MAX_ESTIMATED_FRAMES = 10      # keypoint oculto por mais que isso -> conf 0

# Inferência: "eager" = snapshot fp16 sem compilar (padrão, sem espera);
# "compile" = cudagraph/torchscript (mais rápido, ~2 min para compilar);
# "none" = model.predict original.
INFERENCE_MODE = "eager"
INFERENCE_BATCH = 4

SPORTS = ["volleyball", "basketball"]

for _d in (VIDEO_DIR, RESULTS_DIR, EXPORT_DIR):
    _d.mkdir(parents=True, exist_ok=True)
