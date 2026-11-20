"""Configurações globais do ball_engine."""
from pathlib import Path

# Raiz do pacote ball_engine/
BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
VIDEO_DIR = DATA_DIR / "videos"
ANNOTATION_DIR = DATA_DIR / "annotations"
RESULTS_DIR = DATA_DIR / "results"
EXPORT_DIR = BASE_DIR / "exports"

TRACKNET_REPO_DIR = BASE_DIR / "models" / "tracknet_v3_repo"
TRACKNET_CKPT = TRACKNET_REPO_DIR / "ckpts" / "TrackNet_best.pt"
INPAINTNET_CKPT = TRACKNET_REPO_DIR / "ckpts" / "InpaintNet_best.pt"

# Formato de entrada fixo do TrackNetV3
TRACKNET_HEIGHT = 288
TRACKNET_WIDTH = 512

# Limiar de confiança do TrackNet abaixo do qual o fallback é acionado
TRACKNET_CONF_THRESHOLD = 0.35

# Tamanho máximo de gap (frames) preenchido por interpolação linear simples.
# Gaps maiores ficam sem posição (ou vão para InpaintNet).
MAX_LINEAR_GAP = 2

# Máximo de frames usados para estimar o fundo mediano
MEDIAN_SAMPLE_MAX = 300

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov"}

for _d in (VIDEO_DIR, ANNOTATION_DIR, RESULTS_DIR, EXPORT_DIR):
    _d.mkdir(parents=True, exist_ok=True)
