# pose_engine — análise de atletas com RF-DETR Keypoint

Pipeline: vídeo → RF-DETR Keypoint (boxes + 17 keypoints) → ByteTrack (IDs) →
One Euro Filter (suavização + flag `estimated`) → MP4 anotado + JSONL.

## Uso

```bash
# CLI (da raiz do repo)
python pose_engine/run_pipeline.py --video pose_engine/data/videos/volei.mp4 \
    --sport volleyball --start 0 --end 10
# opções: --mode eager|compile|none (padrão eager)  --batch 4

# Interface
streamlit run pose_engine/app.py

# Testes
python -m pytest pose_engine/tests -v
```

Saídas em `pose_engine/exports/`: `<nome>_annotated.mp4` (H.264, toca no
navegador/Streamlit; reencodado com o ffmpeg do `imageio-ffmpeg`) e `<nome>.jsonl`
(1 registro por frame: frame, timestamp, sport, athletes[{athlete_id, bbox,
pose{keypoint: {x, y, confidence, estimated}}}]).

## Validação (20/11/2026, volley_beach.mp4 — praia, 1080p30, 180 frames)

- 180 frames processados; 3 atletas com IDs estáveis (presenças: 179/134/90 frames).
- 6.851 keypoints: 22% marcados `estimated` (oclusões e movimento rápido),
  confiança média dos detectados 0,95. Nenhum atleta em 1 frame.
- Esqueletos visualmente corretos sobre os corpos no MP4 anotado.

## Ajustes de 20/11/2026 (mesmo vídeo, 179 frames)

| | antes | depois |
|---|---|---|
| presença dos atletas (frames) | 134 / 90 / 179 | 175 / 112 / 178 |
| maior sequência de keypoint congelado | 69 frames | 10 frames |
| inferência (só modelo, RTX 3050) | 9,2 fps | 23,9 fps |
| codec do MP4 | mp4v (não toca no navegador) | H.264 |

- **Limiares**: o detector entrega a partir de 0,25 (`DETECTION_THRESHOLD`);
  o ByteTrack usa ≥ 0,6 para criar tracks e as detecções fracas só
  continuam tracks existentes (é a 2ª etapa do ByteTrack, antes inativa).
- **Keypoint oculto**: fica `estimated` no máximo `MAX_ESTIMATED_FRAMES` (10)
  frames; depois vai a `confidence=0` e não é desenhado. Ao reaparecer, o
  filtro reinicia.
- **ID ↔ detecção**: pelo índice original da detecção, não por IoU; duas
  identidades nunca recebem a mesma detecção.
- **Inferência**: `model.inference()` em fp16, lotes de 4 frames, sem copiar a
  imagem para o resultado. `--mode compile` chega a ~28 fps mas leva ~2 min
  para compilar. Em fp16 a contagem de pessoas perto do limiar pode variar
  em 1 em alguns frames frente ao fp32 (diferença de keypoint ≈ 1 px).

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
- **Árbitros/juízes** dentro do quadro são rastreados como atletas.
- Modelo é **Preview**: API/pesos podem mudar — `rfdetr==1.12.1` está pinado.

## Trocar o modelo

`PoseEstimator` (core/athlete_detector.py) e `Tracker` (core/athlete_tracker.py)
são ABCs — a pipeline recebe qualquer implementação via parâmetro, sem mudança
de código.
