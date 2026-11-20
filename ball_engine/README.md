# Ball Engine — rastreamento de bola (TrackNetV3 + fallback)

Motor de detecção e rastreamento de bola para vôlei e basquete,
núcleo do módulo "medidas com bola" do MOVA.

**Branch:** `teste/tracknet-bola` — validação da tecnologia.

## Status validado (2026-11-20)

| Clipe | Esporte | Frames | Taxa detecção | Fontes |
|---|---|---|---|---|
| `badminton_short.mp4` | (peteca) | 105 | 92,4% | tracknet 91, cor 6, inpaint 2 |
| `volley_beach.mp4` | vôlei praia | 179 | 85,5% | tracknet 148, inpaint 24, cor 5, interp 2 |

Contra o CSV de referência do vídeo de vôlei (saída do VballNet):
mediana de erro **5,8 px**, 92% dentro de 30 px. Nos 10 frames
divergentes (>150 px), inspeção visual mostrou o nosso resultado
**correto** e a referência errada.

Os pesos públicos do TrackNetV3 são treinados para peteca de
badminton, mas transferem parcialmente para bola de vôlei graças ao
contexto temporal + fundo mediano. Fine-tuning por modalidade é o
próximo passo (ver "Evolução").

## Instalação

```bash
pip install -r ball_engine/requirements.txt
# GPU (opcional, recomendado): torch com CUDA
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
```

Checkpoints TrackNetV3 (não versionados, ~136 MB):

```bash
gdown "https://drive.google.com/uc?id=1CfzE87a0f6LhBp0kniSl1-89zaLCZ8cA" \
  -O ball_engine/models/tracknet_v3_repo/TrackNetV3_ckpts.zip
# extrair TrackNet_best.pt e InpaintNet_best.pt para
# ball_engine/models/tracknet_v3_repo/ckpts/
```

O fallback YOLO baixa `yolov8n.pt` automaticamente no primeiro uso.

## Uso

CLI:

```bash
cd ball_engine
python run_pipeline.py --video data/videos/volley_beach.mp4 \
    --sport volleyball --start 0 --end 6
```

Interface:

```bash
streamlit run ball_engine/app.py
```

Saídas: `data/results/*.json|csv` (estrutura por frame com
`source`/`estimated`) e `exports/*_annotated.mp4`.

## Arquitetura

```
core/video_processor.py   leitura de vídeo, metadados, timestamps reais
core/tracknet_detector.py TrackNetV3 (ensemble temporal) + InpaintNet
core/fallback_detector.py YOLO 'sports ball' + heurística cor/forma
core/hybrid_detector.py   orquestra tracknet -> fallbacks por frame
core/ball_tracker.py      gaps curtos (interp), suavização SavGol
core/pipeline.py          ponta a ponta + exports
visualization/            overlay de trajetória no vídeo
tests/                    testes unitários (pytest)
models/tracknet_v3_repo/  código vendored de qaz812345/TrackNetV3
```

Cada posição carrega `source` (`tracknet`/`yolo`/`color_shape`) ou
`estimated` (`inpaintnet`/`interpolated`) — posições estimadas nunca
são contadas como detecção.

## Evolução

- Fine-tune TrackNet por modalidade (dataset format do próprio repo:
  `matchN/video/*.mp4` + `csv/*_ball.csv` com Frame,Visibility,X,Y).
- Alternativa já treinada para vôlei: VballNet (TrackNetV4,
  asigatchov/vball-net-pytorch) — avaliar como backend plugável.
- Próximas fases: jogadores/mãos (YOLO+pose), calibração de quadra,
  motor de física, eventos, comparação — interfaces já previstas no
  schema (`physics`, `event` por frame).
