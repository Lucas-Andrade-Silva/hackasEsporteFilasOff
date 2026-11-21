# pose_engine — análise de atletas com RF-DETR Keypoint

Pipeline: vídeo → RF-DETR Keypoint (boxes + 17 keypoints) → ByteTrack (IDs) →
One Euro Filter (suavização + flag `estimated`) → MP4 anotado + JSONL.

## Uso

```bash
# CLI (da raiz do repo)
python pose_engine/run_pipeline.py --video pose_engine/data/videos/volei.mp4 \
    --sport volleyball --start 0 --end 10

# Interface
streamlit run pose_engine/app.py

# Testes
python -m pytest pose_engine/tests -v
```

Saídas em `pose_engine/exports/`: `<nome>_annotated.mp4` e `<nome>.jsonl`
(1 registro por frame: frame, timestamp, sport, athletes[{athlete_id, bbox,
pose{keypoint: {x, y, confidence, estimated}}}]).

## Validação (20/11/2026, volley_beach.mp4 — praia, 1080p30, 180 frames)

- 180 frames processados; 3 atletas com IDs estáveis (presenças: 179/134/90 frames).
- 6.851 keypoints: 22% marcados `estimated` (oclusões e movimento rápido),
  confiança média dos detectados 0,95. Nenhum atleta em 1 frame.
- Esqueletos visualmente corretos sobre os corpos no MP4 anotado.

## Limitações conhecidas

- **Pessoas distantes/pequenas** (ex.: jogador ao fundo em quadra 1080p) podem
  não ser detectadas — o modelo trabalha em 576×576. Mitigar depois com tiling
  ou threshold menor.
- **1º frame sem IDs**: o ByteTrack confirma identidade a partir do 2º frame
  (detecções não confirmadas são ignoradas, nunca ganham ID provisório).
- **Câmera móvel**: ByteTrack não compensa movimento de câmera — trocar por
  `BoTSORTTracker`/`OCSORTTracker` (mesmo pacote `trackers`, já instalado)
  implementando a ABC `Tracker`.
- **Keypoints**: COCO-17 — sem coluna, mãos ou pés (precisaria de outro modelo).
- **Velocidade**: ~1–3 fps de processamento em RTX 3050 (modelo Preview sem
  otimização de inferência). O caminho `.inference()` do rfdetr é mais rápido.
- Modelo é **Preview**: API/pesos podem mudar — `rfdetr==1.12.1` está pinado.

## Trocar o modelo

`PoseEstimator` (core/athlete_detector.py) e `Tracker` (core/athlete_tracker.py)
são ABCs — a pipeline recebe qualquer implementação via parâmetro, sem mudança
de código.
