"""Interface Streamlit — upload, seleção de trecho, rastreamento e exportação.

Executar a partir da raiz do repo:
    streamlit run ball_engine/app.py
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import streamlit as st  # noqa: E402
import pandas as pd  # noqa: E402
import plotly.express as px  # noqa: E402

from config.settings import VIDEO_DIR, RESULTS_DIR, EXPORT_DIR  # noqa: E402
from config.sports_config import SPORTS  # noqa: E402
from core.video_processor import probe  # noqa: E402
from core.pipeline import run_analysis  # noqa: E402

st.set_page_config(page_title="MOVA — Ball Engine", layout="wide")
st.title("Rastreamento de bola — VballNet / TrackNetV3 + fallback")

# ---------------- Tela 1: seleção e upload ----------------
st.sidebar.header("Configuração")
sport = st.sidebar.selectbox(
    "Esporte", list(SPORTS.keys()),
    format_func=lambda k: SPORTS[k]["label"])

uploaded = st.sidebar.file_uploader(
    "Vídeo (mp4/avi/mov)", type=["mp4", "avi", "mov"])

# Vídeos já enviados
existing = sorted(VIDEO_DIR.glob("*.mp4")) + \
    sorted(VIDEO_DIR.glob("*.avi")) + sorted(VIDEO_DIR.glob("*.mov"))
chosen = st.sidebar.selectbox("…ou escolha um vídeo já enviado",
                              [""] + [p.name for p in existing])

video_path = None
if uploaded is not None:
    video_path = VIDEO_DIR / uploaded.name
    if not video_path.exists():
        video_path.write_bytes(uploaded.getbuffer())
elif chosen:
    video_path = VIDEO_DIR / chosen

if video_path is None:
    st.info("Envie um vídeo ou selecione um já enviado para começar.")
    st.stop()

try:
    info = probe(video_path)
except Exception as e:
    st.error(f"Não foi possível ler o vídeo: {e}")
    st.stop()

c1, c2, c3, c4 = st.columns(4)
c1.metric("FPS", f"{info.fps:.2f}")
c2.metric("Resolução", f"{info.width}x{info.height}")
c3.metric("Frames", info.frame_count)
c4.metric("Duração", f"{info.duration:.1f}s")

st.video(str(video_path))

# Seleção de trecho
start_s, end_s = st.slider(
    "Trecho para análise (segundos)", 0.0, float(info.duration),
    (0.0, min(float(info.duration), 10.0)), step=0.1)
start_frame = int(start_s * info.fps)
end_frame = min(info.frame_count, int(end_s * info.fps))
st.caption(f"Frames {start_frame}–{end_frame} ({end_frame - start_frame} frames)")

from core.hybrid_detector import BALL_MODELS, default_ball_model  # noqa: E402

_MODEL_LABELS = {
    "vballnet": "VballNet (treinado para vôlei)",
    "tracknet": "TrackNetV3 (pesos de badminton)",
    "none": "Nenhum (só fallbacks)",
}
ball_model = st.sidebar.selectbox(
    "Modelo de bola", BALL_MODELS, index=BALL_MODELS.index(default_ball_model()),
    format_func=_MODEL_LABELS.get)
use_yolo = st.sidebar.checkbox("Fallback YOLO", value=True)
use_color = st.sidebar.checkbox("Fallback cor+forma", value=True)

# ---------------- Tela 2: processamento ----------------
if st.button("Iniciar processamento", type="primary"):
    from core.hybrid_detector import HybridBallDetector

    bar = st.progress(0.0, text="Inicializando...")
    status = st.empty()

    def on_progress(p, msg):
        bar.progress(min(1.0, p), text=msg)
        status.caption(msg)

    with st.spinner("Carregando modelos..."):
        detector = HybridBallDetector(
            sport=sport, ball_model=ball_model,
            use_yolo=use_yolo, use_color=use_color)

    try:
        result, stats = run_analysis(
            video_path, sport, start_frame, end_frame,
            detector=detector, on_progress=on_progress)
    except Exception as e:
        st.error(f"Falha no processamento: {e}")
        raise
    st.session_state["result"] = result
    st.session_state["stats"] = stats

# ---------------- Tela 3: resultados ----------------
if "result" in st.session_state:
    result = st.session_state["result"]
    stats = st.session_state["stats"]

    st.subheader("Resultado do rastreamento")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Frames processados", stats["frames_processados"])
    m2.metric("Detecções", stats["detectados"])
    m3.metric("Estimadas (inpaint/interp)", stats["estimados"])
    m4.metric("Taxa de detecção", f"{stats['taxa_deteccao']*100:.1f}%")
    st.caption(f"Por fonte: {stats['por_fonte']}")

    df = result.to_dataframe()

    annotated = EXPORT_DIR / (
        f"{Path(result.video_path).stem}_{result.processed_start}_"
        f"{result.processed_start + len(result.records)}_annotated.mp4")
    if annotated.exists():
        st.subheader("Vídeo anotado")
        st.video(str(annotated))

    st.subheader("Confiança por frame")
    fig = px.scatter(df, x="frame", y="confidence", color="source",
                     hover_data=["x", "y", "estimated"])
    st.plotly_chart(fig, width="stretch")

    st.subheader("Trajetória (coordenadas de pixel)")
    det_df = df[df["visibility"]]
    fig2 = px.scatter(det_df, x="x", y="y", color="estimated",
                      labels={"x": "x (px)", "y": "y (px)"})
    fig2.update_yaxes(autorange="reversed")
    st.plotly_chart(fig2, width="stretch")

    st.subheader("Exportar")
    stem = Path(result.video_path).stem
    csv_path = RESULTS_DIR / f"{stem}_{result.processed_start}_{result.processed_start + len(result.records)}.csv"
    json_path = csv_path.with_suffix(".json")
    col_a, col_b = st.columns(2)
    if csv_path.exists():
        col_a.download_button("CSV", csv_path.read_bytes(),
                              file_name=csv_path.name)
    if json_path.exists():
        col_b.download_button("JSON", json_path.read_bytes(),
                              file_name=json_path.name)
    st.dataframe(df.head(200))
