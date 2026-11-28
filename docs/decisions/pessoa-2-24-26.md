# Pessoa 2 — Primeira fatia de implementação (24–26/11)
Base: plano mestre v2.1, G1–G3. Status de código não equivale a aceite completo. Nenhuma data ou prioridade alterada.

| ID | Estado nesta entrega | Pendência para aceite |
|---|---|---|
| FE01 | Scaffold, manifest, ícone, scripts | build/instalação/offline e CI confirmados |
| FE02 | Tokens, componentes e estilos responsivos CSS | fontes, Tailwind, contraste/a11y testados |
| FE03 | Home e navegação | smoke browser |
| FE04 | Vôlei/Basquete e missão | persistir seleção/contrato definitivo |
| FE05 | Instruções e consentimento privado | teste de uso e segurança |
| FE06 | Câmera privada, timer, cancelamento e teardown | teste de permissões/aparelho |
| FE07 | Overlay MediaPipe real implementado | validar coordenadas, confiança e modelo em browser |
| FE08 | Loading/erro/timeout API; captura curta | timeout de modelo/worker e integração real |
| FE09 | Resultado sintético com selo, unidade e erro | motor real CV12 e incerteza CV11 |
| FE10 | Passaporte de demo | histórico autenticado e integração remota |
| FE11 | Ranking de perfis fictícios e melhor marca por protocolo na sessão | grupo real, RLS e regra de empate validada |
| FE12 | Demo anônima de replay parcial D01–D06 | CV04 vídeo sintético e CV12 inferência real; confirmação organização |
| FE13 | Lab com fórmula, versões e status pendente | benchmark CV13 e incerteza CV11 |
| BE01 | Contratos e API de demo | aprovação com CV02, demais endpoints e erros |
| BE02 | .env.example e configuração opcional | projeto MOVA dedicado e quotas |
| BE03 | SQL rascunho demo | migrations CLI, entidades restantes, seeds e teste |
| BE04 | RLS deny-by-default e grants servidor no rascunho | teste real de acesso cruzado e políticas de atletas |
| BE05 | Sessão demo opcional com cookie/TTL | autenticação e fluxo adulto persistente |
| BE06 | Persistência demo local e adapter remoto | executar contra banco; tentativas reais pendentes |
| BE07 | Recálculo server-side de fixture conhecida | CV12 para evidência real e verificação |
| BE08 | chave idempotente e unique no SQL | teste concorrente e sessão inicial; local sem garantia server-side |
| BE09 | Ranking derivado de marcas sintéticas e perfis fictícios | grupos, ranking remoto e filtros completos |
| BE10 | histórico por aba ou sessão remota | testar banco e histórico autenticado |
| BE11 | reset local/remoção remota, TTL de acesso | teste duas sessões, limpeza TTL/rate limit |
| BE12 | exclusão da sessão demo | exclusão de perfil e retenção real pendentes |
| BE13 | scripts e configuração de deploy | CI executado, lockfile, Vercel preview HTTPS |

G1/G2/G3 não homologados. O modelo não é chamado na demo; eventos são sintéticos predefinidos e calculados via API, com trajetória de landmarks sintéticos compartilhada para replay. O caso de rejeição é anotado, não classificação automática. Não apresentar como pipeline de vídeo completo. Modo local não substitui Supabase real. Sem projetos de infraestrutura MOVA identificados; não usar projetos alheios. Próximo gate: validar build e CI, conectar banco dedicado, testar isolamento, integrar contratos da Pessoa 1, testar dispositivos e deploy. Não expor produção antes de limitar abuso e executar limpeza TTL.
