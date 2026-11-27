# Infraestrutura e homologação — MOVA Brasil
Base de runtime: commit `fd4df5153462f59289569339bd932c6859e6a4de`, branch `feat/pessoa-2-mvp`. PR #1. Nenhuma alteração de escopo ou merge na main.

## Vercel
Projeto dedicado criado no workspace disponível, nome `mova-brasil`, Node 22.x, proteção de preview e `ENABLE_PRIVATE_CAPTURE=false`.
A instalação GitHub no Vercel não está autorizada: tentativa de vincular repo retornou 400. O primeiro snapshot sem target explícito foi classificado como production e cancelado durante build; tentativa target=preview retornou 400; novo deploy usou target=staging. Snapshot do runtime (15 arquivos), não conexão Git automática. Não houve promoção de produção.
Deployment staging: https://mova-brasil-708xrsnxf-pablo-marchinas-projects.vercel.app
Status e acesso devem ser conferidos no painel Vercel; a demo tem persistência local até configurar banco.
Após instalar Vercel GitHub App para este repo: vincular repo em Settings > Git, manter main como produção e validar PR antes de promover. Não desabilitar proteção para testes.

## Supabase
A organização disponível está no plano Free; os projetos existentes são de outros produtos e não foram alterados. Criação do projeto MOVA depende da confirmação da organização pelo usuário, cotação e aceite de custo não zero. Nenhuma chave recuperada ou exposta.
Preparação: schema-draft.sql, com RLS e grants server-only. Testes da nova workflow database-qa.yml executam SQL em PostgreSQL descartável (não Supabase hospedado). Verificar resultados no Actions. SQL não aplicado ao banco remoto. Depois de autorizar projeto dedicado:
1. Confirmar região São Paulo e custo; criar projeto, aguardar ACTIVE_HEALTHY.
2. Aplicar schema validado via migration registrada e executar advisors.
3. Configurar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY diretamente nos segredos do Vercel Preview; não usar NEXT_PUBLIC e não copiar chaves para chat/repo.
4. Fazer novo deploy, validar GET com persistence=supabase, cookies e dois contextos isolados, concorrência/idempotência, reset, TTL e limpeza.
5. Configurar retenção/limpeza e rate limit antes de abrir acesso público; autenticação adulta e entidades reais permanecem pendentes.

## Evidências
- CI do runtime fd4df5153462f59289569339bd932c6859e6a4de: https://github.com/Lucas-Andrade-Silva/hackasEsporteFilasOff/actions/runs/45918817754 (success).
- Teste SQL descartável: novo workflow, verificar execução do commit que inclui este documento.
- Staging: verificar READY e resposta HTTP real; não inferir sucesso de aplicação apenas pelo build.
- Homologação final bloqueada por ausência de banco remoto e motor CV12; teste físico/Android e câmera permanecem pendentes. Não usar dados reais em demo.

## Evidências confirmadas nesta revisão
- Staging READY, target=staging, runtime do commit fd4df51. HTTP 200 em /, /demo, /manifest.webmanifest e /api/demo (modo local, sem banco remoto). Acesso por autenticação Vercel; nenhuma chave compartilhada no repositório.
- [CI de aplicação](https://github.com/Lucas-Andrade-Silva/hackasEsporteFilasOff/actions/runs/45922107093) e [CI SQL descartável](https://github.com/Lucas-Andrade-Silva/hackasEsporteFilasOff/actions/runs/45922107330): sucesso no commit 861dcc9. O teste SQL não valida integração remota PostgREST nem isolamento via cookie.
- Acrescentados testes E2E Chromium desktop e emulação Pixel 7, e restrição SQL para fonte ausente. Acompanhar CI da revisão atual; emulação não substitui teste Android físico.
