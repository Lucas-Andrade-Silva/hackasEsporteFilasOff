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

# VballNet (asigatchov/vball-net-pytorch, MIT) — modelo de grade treinado
# para vôlei, exportado em ONNX. Não versionado; ver README.
VBALLNET_DIR = BASE_DIR / "models" / "vballnet"
VBALLNET_ONNX = VBALLNET_DIR / "VballNetGridV1b_seq9_grayscale_20260319_193937.onnx"
# Confiança mínima da célula. Avaliado nos Shorts: 0.7 dá ~14/16 acertos
# na praia e ~10/16 no ginásio; 0.5 aceita muito reflexo de piso.
VBALLNET_CONF = 0.7

# Modelo de bola padrão: "vballnet" (se os pesos existirem) ou "tracknet"
DEFAULT_BALL_MODEL = "vballnet"

# Formato de entrada fixo do TrackNetV3
TRACKNET_HEIGHT = 288
TRACKNET_WIDTH = 512

# Limiar de confiança do TrackNet abaixo do qual o fallback é acionado
TRACKNET_CONF_THRESHOLD = 0.35

# Tamanho máximo de gap (frames) preenchido por interpolação linear simples.
# Gaps maiores ficam sem posição (ou vão para InpaintNet).
MAX_LINEAR_GAP = 2

# Fallback sem contexto de trajetória (nenhum vizinho detectado): só
# aceita YOLO com confiança alta, no frame inteiro.
UNGATED_YOLO_CONF = 0.5

# Máximo de frames usados para estimar o fundo mediano
MEDIAN_SAMPLE_MAX = 300

# InpaintNet só preenche lacunas *internas* (detecção antes e depois) de
# até este tamanho. Lacunas longas viram "sem posição": acima disso o
# modelo está chutando, não estimando.
MAX_INPAINT_GAP_S = 0.5

# Fundo mediano (entrada do TrackNet com bg_mode=concat):
# - cortes de cena: correlação de histograma HSV entre frames seguidos
SCENE_CUT_HIST_CORR = 0.5
# - câmera em movimento: percentil 75 do deslocamento global entre
#   frames (px, grade de 256 px de largura) acima disto -> fundo por
#   janela curta. Câmera fixa ~0.05; celular na mão ~0.6; pan de TV ~2.6
CAMERA_MOTION_PX = 0.4
# - janela do fundo quando a câmera se move (segundos)
BG_BLOCK_S = 1.0
BG_SAMPLES_PER_BLOCK = 10

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov"}

for _d in (VIDEO_DIR, ANNOTATION_DIR, RESULTS_DIR, EXPORT_DIR):
    _d.mkdir(parents=True, exist_ok=True)
