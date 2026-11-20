# Design: Motor de análise biomecânica com RF-DETR (FASES 1–5)

> **Status:** proposta aprovada em conversa (2026-11-20). Escopo: primeiro marco funcional.
> **Branch:** `teste/rfdetr-pose`
> **Contexto:** projeto MOVA Brasil (Hack Brasil 2026). Este documento detalha o design do
> `pose_engine/`, subsistema novo ao lado do `ball_engine/` existente. Não toca em nada do
> motor de bola.

## 1. Objetivo e escopo deste marco

Entregar uma aplicação funcional que:

1. Recebe um vídeo (MP4/AVI/MOV) de vôlei ou basquete, com câmera fixa ou em movimento.
2. Detecta cada jogador com RF-DETR Keypoint Preview (boxes + 17 keypoints COCO em um
   único forward).
3. Mantém um `athlete_id` estável por jogador via ByteTrack.
4. Desenha bounding boxes, IDs e esqueleto corporal sobre o vídeo.
5. Exporta dados estruturados por frame (JSON) incluindo confiança e flag `estimated`
   para keypoints preenchidos por interpolação.
6. Roda via CLI (`run_pipeline.py`) e via interface Streamlit (`app.py`).

**Fora de escopo neste marco** (fases seguintes do spec original): cálculo de ângulos
articulares, detecção de saltos, classificação de movimentos, analisadores de vôlei e
basquete, calibração de câmera, comparação entre atletas, relatórios PDF. A arquitetura
já prevê esses módulos (o `biomechanics_engine` vai consumir o JSON produzido aqui), mas
nenhum deles é implementado agora.

**Princípio de honestidade do spec:** nenhuma métrica entra na saída sem ter sido
efetivamente calculada; dados estimados são diferenciados de dados detectados.

## 2. Decisões técnicas

| Decisão | Escolha | Motivo |
|---|---|---|
| Detecção + pose | `RFDETRKeypointPreview` (pacote `rfdetr`, Apache 2.0) | Boxes + 17 keypoints num único forward; ~40M params, 576×576 — roda na RTX 3050 6GB |
| Tracking | `sv.ByteTrack` (supervision, dependência do rfdetr) | IDs estáveis em câmera fixa; `Tracker` ABC permite trocar por BoT-SORT/OC-SORT depois |
| Suavização temporal | One Euro Filter por keypoint | Padrão para pose em vídeo: reduz jitter mantendo responsividade em movimento rápido |
| Modelo de pose alternativo | Interface `PoseEstimator`; RTMPose fica para fase de comparação | Spec exige plugabilidade; `mmpose` no Windows é custoso — não instalar agora |
| Formato de saída | JSONL (1 objeto por frame) + MP4 anotado | Streaming-friendly, fácil de converter para DataFrame/PDF depois |
| Vídeo anotado | `supervision` annotators + `cv2.VideoWriter` (mp4v) | Sem dependência de FFmpeg para o MVP; FFmpeg entra na fase de relatórios se necessário |

Versões: `rfdetr` fixado em uma release com ≥7 dias de publicação no momento da
instalação (registrar a versão exata em `requirements.txt`). Demais deps seguem os
mínimos já usados no `ball_engine` (torch, opencv, numpy, scipy, pandas, streamlit,
plotly — reutilizar a mesma env).

## 3. Estrutura

```
pose_engine/
├── __init__.py
├── config/
│   ├── settings.py          # thresholds, paths, device, resolução do modelo
│   └── keypoints.py         # COCO-17 → nomes do spec; SKELETON_EDGES; cores
├── core/
│   ├── schema.py            # Keypoint, Pose, TrackedAthlete, FrameResult (+ to_dict)
│   ├── video_processor.py   # metadata do vídeo, iteração de frames, corte de trecho
│   ├── athlete_detector.py  # PoseEstimator ABC + RFDETRPoseEstimator
│   ├── athlete_tracker.py   # Tracker ABC + ByteTrackTracker
│   ├── keypoint_processor.py# One Euro Filter por (track_id, keypoint); interpolação → estimated
│   └── pipeline.py          # orquestra: vídeo → pose → track → suavização → saídas
├── visualization/
│   └── skeleton_overlay.py  # esqueleto + bbox + track_id + cor por confiança
├── app.py                   # Streamlit: upload → parâmetros → processa → preview/download
├── run_pipeline.py          # CLI equivalente
├── requirements.txt
├── data/videos/             # vídeos de entrada (gitignored, exceto .gitkeep)
├── exports/                 # saídas JSONL/MP4 (gitignored)
└── tests/
    ├── test_schema.py
    ├── test_video_processor.py
    ├── test_keypoint_processor.py
    ├── test_tracker.py      # ByteTrack com detecções sintéticas
    └── test_pipeline.py     # smoke com detector mockado
```

`sports/` e os módulos de biomecânica/comparação não são criados ainda (YAGNI — entram
nas fases 6+ com o consumidor real definido).

## 4. Contratos de dados

```python
@dataclass
class Keypoint:
    name: str            # "left_shoulder", "right_ankle", ... (nomes do spec)
    x: float
    y: float
    confidence: float    # 0-1, do modelo
    estimated: bool      # True se preenchido por interpolação, não detectado

@dataclass
class TrackedAthlete:
    track_id: int
    bbox: tuple[float, float, float, float]  # x1,y1,x2,y2
    bbox_confidence: float
    pose: list[Keypoint]                     # 17 pontos, sempre completo

@dataclass
class FrameResult:
    frame: int
    timestamp: float       # segundos, derivado do FPS real do vídeo
    sport: str
    athletes: list[TrackedAthlete]
```

JSON por frame (linha em `.jsonl`), seguindo o schema do spec original:

```json
{"frame": 120, "timestamp": 4.0, "sport": "volleyball",
 "athletes": [{"athlete_id": 3, "bbox": [...], "bbox_confidence": 0.97,
   "pose": {"left_shoulder": {"x": 420.0, "y": 180.0, "confidence": 0.98,
                              "estimated": false}, ...}}]}
```

`FrameResult.to_dict()` é a única fonte de serialização — Streamlit e CLI usam o mesmo
caminho.

## 5. Componentes

**`video_processor`**: `VideoMetadata(fps, width, height, frame_count, duration)` via
`cv2.VideoCapture`; iterador `iter_frames(start_s, end_s)` produzindo
`(frame_idx, timestamp, frame_bgr)`. Falha rápido com mensagem clara se o codec não abre.

**`PoseEstimator`** (ABC): `predict(frame_bgr) -> list[PoseDetection]` onde
`PoseDetection = (bbox, bbox_conf, keypoints[17] com conf)`. `RFDETRPoseEstimator`
encapsula `RFDETRKeypointPreview`, mapeia COCO-17 → nomes do spec, aplica
`threshold` de detecção, marca `estimated=False` em tudo que vem do modelo. Device:
`cuda` se disponível, senão `cpu` (log do que foi usado).

**`Tracker`** (ABC): `update(detections) -> list[(track_id, bbox)]`.
`ByteTrackTracker` usa `sv.ByteTrack` sobre as boxes de pessoa vindas da predição
(`sv.Detections.from_keypoints` ou boxes equivalentes do modelo); o `track_id` é
associado ao conjunto de keypoints da detecção correspondente (correspondência por
índice/IoU, resolvida na implementação). Detecções que o tracker descarta não geram
atleta no frame. `lost_tracks` são reportados para o processador saber quando pausar
filtros.

**`keypoint_processor`**: um `OneEuroFilter(min_cutoff, beta)` por (track_id, keypoint).
Keypoints com conf < `KEYPOINT_MIN_CONF` são substituídos pela estimativa do filtro e
marcados `estimated=True`; se não há histórico suficiente, ficam com `confidence=0` e
não entram nos cálculos posteriores. Filtro reinicia quando a track reaparece após
`MAX_LOST_FRAMES`.

**`skeleton_overlay`**: desenha por atleta — bbox + `#{track_id}`, arestas do esqueleto
com cor por confiança média, vértices (keypoints `estimated` em estilo tracejado/menor).

**`pipeline`**: `run(video_path, sport, start_s, end_s, out_dir, progress_cb)` →
`(annotated_mp4_path, jsonl_path)`. Loop: frame → `pose.predict` → `tracker.update` →
`keypoint_processor.apply` → acumula `FrameResult` → overlay → writer. Progresso via
callback (Streamlit e CLI compartilham).

**`app.py` (Streamlit)**: upload → salva em `data/videos/`; seletor de esporte e trecho;
botão processa com barra de progresso; exibe vídeo anotado + preview do JSON; botões de
download. Processamento roda em thread com `st.session_state` guardando resultados —
sem rerun a cada frame.

**`run_pipeline.py` (CLI)**: `python run_pipeline.py video.mp4 --sport volleyball
--start 5 --end 20 --out exports/` com a mesma `pipeline.run`.

## 6. Tratamento dos casos do spec

| Caso | Estratégia neste marco |
|---|---|
| Oclusão entre jogadores | ByteTrack mantém ID por `track_thresh`/`match_thresh`; keypoint ausente → `estimated` |
| Jogador parcialmente visível | Keypoints fora do frame ficam com conf do modelo; < threshold → `estimated`/ausente |
| Movimentos rápidos | One Euro com `beta` alto reduz lag em velocidade; sem motion blur handling ainda |
| Câmera em movimento | ByteTrack pode perder ID → documentado como limitação; `Tracker` ABC permite BoT-SORT (com camera motion compensation) depois |
| Mudança de iluminação / perspectiva | Sem tratamento especial no MVP; registrado como limitação |

## 7. Testes e validação

- **Unitários** (rápidos, sem modelo): schema serializa/parseia; filtro de keypoints
  suaviza e marca `estimated`; ByteTrack mantém ID com detecções sintéticas estáveis e
  reassocia após oclusão curta; `video_processor` lê metadata e respeita corte de trecho
  (vídeo sintético gerado com cv2).
- **Smoke do pipeline** (sem modelo): `PoseEstimator` mockado + vídeo sintético com 2
  "pessoas" em movimento → JSONL com N linhas, IDs estáveis, MP4 de saída abre.
- **Validação real** (manual, marcada fora do CI): rodar num vídeo de vôlei baixado pelo
  usuário; critérios do spec — detecta jogadores, IDs não trocam em lance normal,
  esqueleto acompanha o corpo, JSON tem confiança por keypoint.

## 8. Riscos e limitações conhecidas

- **VRAM 6GB**: `RFDETRKeypointPreview` (40M params, 576×576) cabe folgado em inferência
  fp32; se estourar, reduzir batch a 1 (já é o caso) e/ou fp16.
- **Modelo Preview**: API e pesos podem mudar antes do release estável — pinar versão
  do pacote e registrar no requirements.
- **Licença**: Apache 2.0 — uso comercial ok; registrar na documentação.
- **17 keypoints COCO**: cobre todos os pontos exigidos pelo spec (ombros, cotovelos,
  punhos, quadris, joelhos, tornozelos, nariz/olhos/orelhas ≈ "cabeça"). Sem pontos de
  coluna/mãos/pés — isso exigiria outro modelo (limitação documentada; o spec prevê
  modelos com pontos adicionais como avaliação futura).
- **IDs em câmera móvel**: ByteTrack sem compensação de movimento de câmera pode
  reatribuir IDs; aceito no MVP e sinalizado na saída/docs.
- **Windows + torch 2.11**: rfdetr deve funcionar; se houver incompatibilidade de
  versão do pacote com torch novo, cair para a env do `ball_engine` ou fixar torch.

## 9. Plano de implementação (resumo — detalhe no plano)

1. Scaffold `pose_engine/` + requirements + instala `rfdetr` (verifica download do peso).
2. `schema` + `keypoints.py` (mapa COCO-17) + testes.
3. `video_processor` + testes com vídeo sintético.
4. `athlete_detector` (ABC + RF-DETR) — valida inferência numa imagem real.
5. `athlete_tracker` + `keypoint_processor` + testes sintéticos.
6. `skeleton_overlay` + `pipeline` + smoke test.
7. `run_pipeline.py` (CLI) + `app.py` (Streamlit).
8. Validação com vídeo real do usuário + registro de limitações.
