"""Interface Streamlit — upload, seleção de trecho, pose + tracking, exportação.

Executar a partir da raiz do repo:
    streamlit run pose_engine/app.py
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import pandas as pd  # noqa: E402
import streamlit as st  # noqa: E402

from config.settings import EXPORT_DIR, SPORTS, VIDEO_DIR  # noqa: E402
from core.video_processor import probe  # noqa: E402

st.set_page_config(page_title="MOVA — Pose Engine", layout="wide")
st.title("Análise de atletas — RF-DETR Keypoint + ByteTrack")


@st.cache_resource
def carregar_estimador():
    from core.athlete_detector import RFDETRPoseEstimator
    return RFDETRPoseEstimator()


# ---------------- Tela 1: seleção e upload ----------------
st.sidebar.header("Configuração")
sport = st.sidebar.selectbox("Esporte", SPORTS)
upload = st.sidebar.file_uploader("Vídeo", type=["mp4", "avi", "mov"])

if upload is not None:
    video_path = VIDEO_DIR / upload.name
    if not video_path.exists():
        video_path.write_bytes(upload.read())

    meta = probe(video_path)
    c1, c2, c3 = st.columns(3)
    c1.metric("Resolução", f"{meta.width}x{meta.height}")
    c2.metric("FPS", f"{meta.fps:.1f}")
    c3.metric("Duração", f"{meta.duration:.1f}s")

    trecho = st.sidebar.slider(
        "Trecho (s)", 0.0, float(meta.duration),
        (0.0, float(min(10.0, meta.duration))), step=0.5)

    if st.button("Processar", type="primary"):
        from core.pipeline import run

        bar = st.progress(0.0, text="Processando frames...")
        with st.spinner("Carregando modelo RF-DETR (1ª vez baixa os pesos)"):
            est = carregar_estimador()
        res = run(video_path, sport, EXPORT_DIR,
                  start_s=trecho[0], end_s=trecho[1], estimator=est,
                  progress_cb=lambda f: bar.progress(
                      min(f, 1.0), text=f"Processando frames... {f:.0%}"))
        st.session_state["result"] = res
        bar.empty()

# ---------------- Resultado ----------------
res = st.session_state.get("result")
if res:
    st.success(f"{res['frames']} frames | atletas: {res['athletes_seen']}")
    col_v, col_d = st.columns([3, 2])
    with col_v:
        st.subheader("Vídeo anotado")
        st.video(str(res["video_path"]))
        with open(res["video_path"], "rb") as f:
            st.download_button("Baixar MP4 anotado", f,
                               file_name=res["video_path"].name)
    with col_d:
        st.subheader("Dados por frame")
        linhas = [l for l in res["jsonl_path"].read_text(
            encoding="utf-8").splitlines() if l.strip()]
        import json
        recs = [json.loads(l) for l in linhas]
        st.dataframe(pd.DataFrame(
            [{"frame": r["frame"], "timestamp": round(r["timestamp"], 2),
              "n_atletas": len(r["athletes"]),
              "ids": [a["athlete_id"] for a in r["athletes"]]}
             for r in recs]), use_container_width=True, height=300)
        with open(res["jsonl_path"], "rb") as f:
            st.download_button("Baixar JSONL", f,
                               file_name=res["jsonl_path"].name)
        with st.expander("Exemplo de registro"):
            st.json(recs[len(recs) // 2])
else:
    st.info("Envie um vídeo na barra lateral para começar.")
