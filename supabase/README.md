# Supabase MOVA
O arquivo schema-draft.sql é SQL de desenvolvimento, não migration homologada. Nenhum banco remoto foi alterado. O conector mostrou apenas projetos de outros produtos; não os utilizar.
1. Criar/selecionar um projeto dedicado MOVA sem gasto não autorizado.
2. Inicializar a CLI local conforme versão instalada (supabase init --help). Verificar schema numa instância local; gerar migration com supabase migration new e registrar a versão depois dos testes.
3. Testar grants/RLS usando anon, authenticated e server role; executar teste de duas sessões, concorrência, TTL e exclusão.
4. Aplicar migration no ambiente de desenvolvimento autorizado; definir SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY exclusivamente server-side.
5. Configurar limpeza de sessões expiradas; adicionar limite de tentativas/rate limiting antes de expor publicamente.
O SQL atual cobre somente demo_sessions/demo_attempts. Profiles, grupos, protocolos, challenges, tentativas reais, traces e verificação/autenticação adulta ainda não implementados. Não armazenar vídeo bruto. O serviço de demo utiliza token aleatório HttpOnly, hash em banco, expiração e escopo por sessão.
