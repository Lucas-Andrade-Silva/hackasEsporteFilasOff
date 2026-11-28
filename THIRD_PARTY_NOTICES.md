# Inventário preliminar de terceiros (CV01 / PD01)
- Next.js (MIT): https://github.com/vercel/next.js/blob/canary/license.md
- React (MIT): https://github.com/facebook/react/blob/main/LICENSE
- MediaPipe Tasks Vision (Apache-2.0, código): https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE ; pacote 0.10.35, WASM CDN com versão, Pose Landmarker Lite float16/1: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker . Conferir model card e checksum do asset efetivamente carregado antes de submissão. Nenhum peso novo copiado no Git.
- Playwright (Apache-2.0): https://github.com/microsoft/playwright/blob/main/LICENSE
- Fontes: nomes Barlow Condensed/Inter apenas fallback CSS; arquivos não distribuídos nesta revisão.
- RF-DETR Preview 1.12.1, ByteTrack, One Euro: branch teste/rfdetr-pose, commit 7a9179f1070d81d683780e94ee0616a7a84537ff. Não copiado para runtime. Auditar licenças específicas dos pesos, vendorização e datasets; não supor licença a partir do nome.
- TrackNetV3, VballNet V1b, YOLO: branch teste/tracknet-bola, commit 6dd7ceaf6fb64a50c4548065b682e88414c2dded. README declara MIT para VballNet, outros pesos e fallback exigem conferência. Não copiados para runtime.
- Fixtures matemáticas: código e dados gerados no projeto, sem vídeos ou pessoas reais.
- Supabase JS (MIT): https://github.com/supabase/supabase-js/blob/master/LICENSE
- Phosphor Icons (MIT): https://github.com/phosphor-icons/react/blob/master/LICENSE
- Inter (SIL Open Font License 1.1), carregada por next/font: https://github.com/rsms/inter/blob/master/LICENSE.txt

## Vídeos dos exercícios (YouTube, incorporados)
Os vídeos não são copiados para o repositório: o app usa o player oficial do YouTube (domínio youtube-nocookie) apontando para um trecho de cada vídeo público, como os termos do YouTube permitem quando o dono deixa a incorporação ativa. Direitos e crédito continuam com cada canal, também creditado no app abaixo do vídeo. Uso provisório no MVP do hackathon, até o time gravar os próprios vídeos.

| Exercício | Canal | Vídeo | Trecho | Link |
|---|---|---|---|---|
| v-bloqueio | Elevate Yourself | Blocking Fundamentals for Volleyball Beginners | 9–17 s | https://www.youtube.com/watch?v=fadS1Cjg58k |
| v-ataque | TORQVB | The Approach | 7–47 s | https://www.youtube.com/watch?v=w6IevIgUfxY |
| v-alcance | The Female Elite | How to Measure Your Vertical Jump and Jump Reach | 4–30 s | https://www.youtube.com/watch?v=ARas7CcMNhU |
| v-deslocamento | Four Athletes | All of the Blocking Footwork You Need | 12–40 s | https://www.youtube.com/watch?v=Pb3eZwTJwKw |
| v-sprint | Wave Volleyball Online | First Step Quickness Drill - Volleyball Defense | 53–88 s | https://www.youtube.com/watch?v=rLAAYYie32U |
| v-toque | Olympic Games | How to become a better volleyball setter ft. Rachael Adams | 77–100 s | https://www.youtube.com/watch?v=sFxs0EPD68Q |
| v-manchete | SIKANA English | Forearm pass | Volleyball | 10–30 s | https://www.youtube.com/watch?v=siDVtYyRG_M |
| v-saque | Get The Pancake | Volleyball Overhand Serving Progressions | 3–38 s | https://www.youtube.com/watch?v=g5sX0LCitgs |
| v-agachamento | FitFx Training | Jump Squats Tutorial | 2–22 s | https://www.youtube.com/watch?v=dkS9j0GJw5E |
| v-saltos | Runna | Pogo Jumps Tutorial | 2–26 s | https://www.youtube.com/watch?v=j0nl5dWuqN4 |
| b-rebote | Howcast | How to Do a Rebounding Drill | 13–24 s | https://www.youtube.com/watch?v=9flg84QWaK4 |
| b-bandeja | Bill Ivey | Basic Layup Footwork | 10–40 s | https://www.youtube.com/watch?v=44xA0RNZ7ys |
| b-alcance | Dre Baldwin | Rim Touches | 0–20 s | https://www.youtube.com/watch?v=xnLVj73NRSg |
| b-deslize | Paul Easton Basketball | Defensive Drill - Defensive Slides | 13–40 s | https://www.youtube.com/watch?v=rTsnVx1I6so |
| b-5105 | IYCA | 5-10-5 Agility Drill | 0–15 s | https://www.youtube.com/watch?v=XSc-g5o2qhY |
| b-drible-alternado | SIKANA English | The Crossover Dribble | Basketball | 35–60 s | https://www.youtube.com/watch?v=M3yD-gwjoRE |
| b-drible-baixo | CoachUp | Pound Dribbling | 15–45 s | https://www.youtube.com/watch?v=YuK1JHuq_aE |
| b-lance-livre | SIKANA English | The Free Throw | Basketball | 20–60 s | https://www.youtube.com/watch?v=iW2VFzBiaQo |
| b-arremesso-salto | SIKANA English | The Jump Shot | Basketball | 37–70 s | https://www.youtube.com/watch?v=qhgs5ZODc4A |

Inventário não é certificação de licença completa. Lockfile e auditoria de dependências transitivas pendentes; não publicar assets reais ou pesos sem direitos confirmados.
