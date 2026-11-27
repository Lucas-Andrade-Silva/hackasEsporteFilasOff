# Verificação sintética inicial — 27/11/2026
Motor jump-0.2.0; 36 trajetórias balísticas geradas pelo mesmo modelo físico que fundamenta a fórmula, 6 durações (300–600ms), 3 taxas, jitter alternado 0/1ms. Executado sobre o código do commit 888ce71. Referência analítica 9.81*t²/8. NÃO é benchmark de inferência de vídeo, precisão clínica, atleta real nem Android físico.
| FPS simulado | n | Aceitas | MAE cm | RMSE cm | Viés cm |
|---:|---:|---:|---:|---:|---:|
|30|12|12|0,713|1,182|+0,653|
|60|12|12|0,042|0,049|+0,003|
|120|12|12|0,030|0,033|-0,014|
10 casos negativos: 9 rejeitados (pés cortados, múltiplos, vazio, sem salto, salto duplo, duplicata, gap, estimado, baixa confiança), 1 experimental (deriva lateral); 0 aceitos. Isso comprova somente comportamento nesses dados artificiais. Nenhuma margem empírica foi calculada. Reproduzir com node benchmarks/synthetic-jump.mjs; CI gera métricas completas, incluindo mediana, latência de cálculo e ambiente. Revisão posterior suaviza somente seleção do ápice; reexecutar para rastreabilidade. A latência de cálculo não inclui download, inferência ou câmera.
## Validação humana ainda não executada
Ver protocolo e instrumentos em research-kit.md. MAE real, referência independente, latência de inferência, teste em 3 dispositivos e generalização são pendentes; não declarar meta 3cm alcançada. Sem publicar vídeos reais.
