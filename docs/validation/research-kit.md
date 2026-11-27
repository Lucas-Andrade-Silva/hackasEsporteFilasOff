# Kit de pesquisa, usabilidade e benchmark — 27/11
Status: instrumentos prontos, coleta NÃO realizada. Guardar respostas/consentimento e contatos privadamente; publicar somente agregados anonimizados. Não recrutar menores. Não coletar saúde, lesões ou dados identificadores desnecessários. Participação voluntária, interrompível e sem exercício em local inseguro. Não prometer diagnóstico.
## PD03 — recrutamento
Metas: 8–12 adultos para benchmark, 10–15 atletas entrevistados, 3–5 treinadores, 2–3 atléticas/escolinhas, 5–10 testes de uso. Convite para enviar aos próprios contatos: "Estamos testando o MOVA Brasil, uma ferramenta experimental de desafios esportivos. Procuramos adultos 18+ que joguem vôlei/basquete, para conversa de 10 min ou teste opcional de 15 min. Você pode parar quando quiser. Não publicaremos vídeo ou identificação. Quer participar?" Sem envio automático ou contatos inventados.
Consentimento privado: explicar finalidade, teste voluntário, dados mínimos, não enviar vídeo, retenção e exclusão, contato do responsável preenchido pelo time. Se houver captura real, validar autorização e regras primeiro; não persistir vídeos no repo/demo.
## PD04 — roteiro atleta (10 min)
1. Modalidade e frequência? 2. Última vez que tentou medir evolução? Como? 3. O que dificulta treinar/acompanhar? 4. O que faria repetir desafio? 5. Mostre o resultado sintético: o que significa válido/experimental/rejeitado? 6. Compartilharia uma marca com o grupo? Com quais controles? 7. O que impediria uso no seu aparelho? Registrar citações somente com permissão, sem nomes.
## PD05 — treinador (15 min)
1. Como mede salto e frequência? 2. Qual equipamento/custo/tempo? 3. Como identifica melhoria real? 4. Como organiza grupos? 5. Aceitaria piloto? Quais exigências? 6. Quem decide compra? Faixa de preço espontânea antes de apresentar hipótese R$199/mês; não induzir.
## PD08 — protocolo de benchmark físico
Referência independente: vídeo de alta velocidade com anotação cega de contato (com permissão e mantido privado) ou plataforma de força, mesma grandeza; não comparar alcance da mão diretamente. 3–5 tentativas por adulto, descanso voluntário, 3 aparelhos incluindo Android de entrada, 30/60 FPS efetivos quando possível, câmeras fixas e alinhadas, ambiente seguro. Separar calibração e avaliação por participante. Registrar todas as tentativas (inclusive rejeitadas), FPS observado, referência, altura, status, latência download/inferência/cálculo, flags, condições e versão. MAE, RMSE, viés, mediana absoluta, cobertura e motivos. Meta exploratória 3cm a 30 FPS, NÃO resultado. Sem referência: apenas teste técnico, não precisão empírica.
## PD09 — teste de usabilidade
Tarefas sem orientação: achar demo, escolher vôlei, realizar cenário válido, localizar altura e significado, rejeitar pés fora de quadro, verificar ranking, histórico, Lab, reset. Observar tempo até primeiro resultado, conclusão independente, erros, compreensão e intenção de retorno. Meta <2min, não medição atual. Alternar esporte e dispositivo; sem câmera na demo. Script: "Não estamos avaliando você; descreva o que espera que aconteça." 
## PD10 — registro de melhoria
| ID | Observação real/QA | mudança | reteste | evidência |
|---|---|---|---|---|
| QA-01 | API anterior calculava de eventos anotados | detector de eventos sobre sequência | testes sintéticos e CI | commit 888ce71 |
| QA-02 | Playwright não suportava Ubuntu 26.04 | runner Ubuntu 24.04 | CI em execução | commit fe740ea |
| QA-03 | captura descartava frames sem métrica | cálculo local experimental | teste físico pendente | commit 888ce71 |
Melhorias de QA técnico, não feedback de entrevistas. Nenhuma alegação de pesquisa com usuários.
## Templates privados (copiar fora do repo)
Atleta/treinador: código; modalidade/papel; dor observada; comportamento atual; evidência/objeção; intenção (sem dados pessoais).
Usabilidade: código; dispositivo; tarefa; concluiu; tempo; erro; compreensão; observação; reteste.
Benchmark: código; dispositivo; protocolo; versão; tentativa; FPS; ref_cm; estim_cm; status; flags; infer_ms; calc_ms. Nunca registrar nomes junto às medidas.
