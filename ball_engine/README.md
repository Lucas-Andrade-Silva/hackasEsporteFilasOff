# Ball Engine — rastreamento de bola (VballNet / TrackNetV3 + fallback)

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

### Depois da revisão de robustez (streaming + trajetória)

| Clipe | Frames | Pico RAM antes → depois | Detecção antes → depois | Erro vs ref. |
|---|---|---|---|---|
| `volley_beach.mp4` | 179 | 6,4 → 1,7 GB | 85,5% → **90,5%** | mediana 5,8 → **5,4 px**; ≤30 px 92,3% → 92,9% |
| `badminton_short.mp4` (inteiro) | 630 | 13,3 → **1,6 GB** | 85,9% → 84,6% | sem referência |

- Memória agora é constante no tamanho do trecho (≈1,6 GB, quase tudo
  modelos carregados); antes crescia ~20 MB por frame.
- No vôlei, 13 lacunas que eram "chutadas" pelo InpaintNet viraram
  detecções reais do YOLO restrito à trajetória (erro 1–9 px).
- No badminton a taxa cai um pouco porque o cor+forma deixou de
  aceitar candidatos sem contexto dos dois lados — troca deliberada de
  cobertura por precisão (sem referência para medir o ganho).

Os pesos públicos do TrackNetV3 são treinados para peteca de
badminton, mas transferem parcialmente para bola de vôlei graças ao
contexto temporal + fundo mediano. Fine-tuning por modalidade é o
próximo passo (ver "Evolução").

### Vídeo real (Shorts verticais) e VballNet

Em dois Shorts verticais (praia com transmissão de TV e ginásio filmado
com celular), o TrackNet com pesos de badminton falhou: a maioria das
detecções caía em reflexos do piso, teto e arquibancada, e o InpaintNet
inventava trajetórias de até 77 frames. Correções no pipeline:

- InpaintNet só em lacunas internas de até 0,5 s e só em tomadas de
  câmera fixa (em coordenadas de imagem, panorâmica quebra o modelo).
- Cortes de cena detectados; cada tomada é processada separadamente,
  com fundo mediano próprio (por janela de 1 s se a câmera se move).
- Vídeo vertical coberto por recortes 16:9 sobrepostos (sem achatar).
- Cor+forma do vôlei sem a faixa "branco" (casava com areia e lâmpadas).

E o modelo de bola padrão passou a ser o **VballNet** (grade, treinado
para vôlei). Conferência visual de 16 detecções por vídeo:

| Modelo | Praia (Short) | Ginásio (Short) | `volley_beach` ≤30 px |
|---|---|---|---|
| TrackNetV3 + correções | ~4/16 | ~1/16 | 92,8% |
| **VballNet V1b, recortes, conf ≥ 0,7** | **~14/16** | **~10/16** | 92,9% |

No pipeline completo com VballNet, no ginásio o cor+forma (bola
amarela) acertou 8/8 e o YOLO 5/5; o erro que resta são reflexos de
lâmpada no piso azul que o VballNet confunde com a bola — próximo passo
é fine-tuning com vídeo de ginásio/celular.

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

Pesos do VballNet (modelo padrão; não versionados, ~7 MB, MIT —
[asigatchov/vball-net-pytorch](https://github.com/asigatchov/vball-net-pytorch)):

```bash
mkdir -p ball_engine/models/vballnet
curl -L -o ball_engine/models/vballnet/VballNetGridV1b_seq9_grayscale_20260319_193937.onnx \
  https://raw.githubusercontent.com/asigatchov/vball-net-pytorch/main/models/VballNetGridV1b_seq9_grayscale_20260319_193937.onnx
```

Sem esses pesos (ou sem `onnxruntime`), o padrão volta a ser o TrackNetV3.
O InpaintNet usa o checkpoint do TrackNetV3 com qualquer modelo.

O fallback YOLO baixa `yolov8n.pt` automaticamente no primeiro uso.

## Uso

CLI:

```bash
cd ball_engine
python run_pipeline.py --video data/videos/volley_beach.mp4 \
    --sport volleyball --start 0 --end 6 [--ball-model vballnet|tracknet|none]
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
core/background.py        recortes (Canvas), cortes de cena, fundo por tomada
core/vballnet_detector.py VballNet (ONNX, grade) em streaming — padrão
core/tracknet_detector.py TrackNetV3 em streaming (ensemble temporal) + InpaintNet
core/trajectory_filter.py escolha de blob, outliers, previsão de posição
core/fallback_detector.py YOLO 'sports ball' + heurística cor/forma (com ROI)
core/hybrid_detector.py   modelo de bola -> filtro -> fallback guiado -> inpaint
core/ball_tracker.py      gaps curtos (interp), suavização SavGol
core/pipeline.py          ponta a ponta + exports
visualization/            overlay de trajetória no vídeo
tests/                    testes unitários (pytest)
models/tracknet_v3_repo/  código vendored de qaz812345/TrackNetV3
```

Fluxo por trecho (o vídeo é lido em streaming, nunca inteiro em RAM):

0. **Análise da tomada**: cortes de cena, câmera fixa ou em movimento,
   fundo mediano. Cada tomada é processada separadamente.
1. **Modelo de bola** gera candidatos por frame: VballNet (até 3
   células por recorte com conf ≥ 0,7) ou TrackNetV3 (blobs do heatmap,
   centroide subpixel). Vídeo fora de 16:9 vira recortes sobrepostos.
2. **Filtro de trajetória**: entre blobs, fica o coerente com os
   vizinhos; posições que exigiriam velocidade impossível
   (`max_speed_diag_s` por esporte) viram lacuna.
3. **Fallback guiado**: nas lacunas, YOLO roda só numa ROI em volta da
   posição prevista; cor+forma só com contexto dos dois lados e raio
   apertado; sem contexto, só YOLO com confiança ≥ 0,5.
4. **InpaintNet** nas lacunas internas de até 0,5 s, só com câmera
   fixa (usa também os pontos do fallback); depois interpolação de gaps
   de até 2 frames que não atravessem corte.

Cada posição carrega `source` (`vballnet`/`tracknet`/`yolo`/`color_shape`) ou
`estimated` (`inpaintnet`/`interpolated`) — posições estimadas nunca
são contadas como detecção.

## Evolução

- Fine-tune do VballNet com vídeo de ginásio/celular (reflexo de
  lâmpada no piso é o erro dominante). O repositório tem `train_grid.py`.
- Filtro de objeto parado (bola real não fica fixa na tela por muitos
  frames com câmera parada) e conferência de cor da bola nos candidatos.
- Próximas fases: jogadores/mãos (YOLO+pose), calibração de quadra,
  motor de física, eventos, comparação — interfaces já previstas no
  schema (`physics`, `event` por frame).
