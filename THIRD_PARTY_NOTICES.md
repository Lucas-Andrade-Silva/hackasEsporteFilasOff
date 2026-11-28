# Inventário preliminar de terceiros (CV01 / PD01)
- Next.js (MIT): https://github.com/vercel/next.js/blob/canary/license.md
- React (MIT): https://github.com/facebook/react/blob/main/LICENSE
- MediaPipe Tasks Vision (Apache-2.0, código): https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE ; pacote 0.10.35, WASM CDN com versão, Pose Landmarker Lite float16/1: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker . Conferir model card e checksum do asset efetivamente carregado antes de submissão. Nenhum peso novo copiado no Git.
- Playwright (Apache-2.0): https://github.com/microsoft/playwright/blob/main/LICENSE
- Fontes: nomes Barlow Condensed/Inter apenas fallback CSS; arquivos não distribuídos nesta revisão.
- RF-DETR Preview 1.12.1, ByteTrack, One Euro: branch teste/rfdetr-pose, commit 7a9179f1070d81d683780e94ee0616a7a84537ff. Não copiado para runtime. Auditar licenças específicas dos pesos, vendorização e datasets; não supor licença a partir do nome.
- TrackNetV3, VballNet V1b, YOLO: branch teste/tracknet-bola, commit 6dd7ceaf6fb64a50c4548065b682e88414c2dded. README declara MIT para VballNet, outros pesos e fallback exigem conferência. Não copiados para runtime.
- Fixtures matemáticas: código e dados gerados no projeto, sem vídeos ou pessoas reais.
Inventário não é certificação de licença completa. Lockfile e auditoria de dependências transitivas pendentes; não publicar assets reais ou pesos sem direitos confirmados.
