# App v2: conta, treinos, ranking e perfil (28/11/2026)

Reformulação da interface a partir do HomeCourt como referência. Branch `feat/app-v2`.

## Decisões
| Tema | Decisão |
|---|---|
| Acesso | Login obrigatório para todos (email e senha, Supabase Auth). Sem modo convidado. |
| Onboarding | 7 perguntas antes do cadastro: esporte, posição, tempo de prática, treinos por semana, objetivo, espaço para gravar e confirmação de 18+. Todos começam com os exercícios zerados. |
| Navegação | 4 abas só com ícone (Phosphor): Treinos, Ranking, Evolução, Perfil. O Lab saiu do app. |
| Visual | Base branca; limão `#CFF500` e lilás `#7B3FF2` só em detalhes. Tema escuro dentro dos grupos e exercícios. Fonte do sistema (SF Pro no iPhone) e Inter nos demais; escala de texto da Apple. |
| Exercícios | 19 exercícios em 8 grupos (4 de vôlei, 4 de basquete). Cada um tem nota mínima, 3 tentativas por dia, moedas de recompensa e uma marca de referência MOVA (meta interna, não atleta real). |
| Botão Iniciar | Mostra "em breve" em todos os exercícios até o sistema de vídeo existir. |
| Imagens | Animações 2D em SVG geradas no app (`src/components/motion-figure.tsx`), sem vídeo para baixar. |
| Ranking | Liga opcional: grupos de até 20 pessoas da mesma divisão de moedas (0, 100, 300, 600, 1000, 1500), com realocação ao mudar de divisão. Amigos: grupos privados por código de 6 caracteres. Os dois modos podem coexistir. |

## Segurança dos dados
- RLS em todas as tabelas. Cada pessoa lê e edita só o próprio perfil e as próprias atividades.
- Moedas e confirmação de 18+ não são graváveis pelo cliente (grant por coluna).
- Nome, foto e moedas de outras pessoas só saem pelas funções de ranking, e só para quem está na mesma liga ou no mesmo grupo.
- O cadastro sem 18+ é recusado no banco, pelo gatilho que cria o perfil.
- Testes: `tests/database/app-v2.sql` (Postgres descartável, no CI `database-qa.yml`).

## Para colocar no ar
1. **Banco:** no SQL Editor do projeto `nxsnyfvqhbiofsivnnuc`, rodar `supabase/migrations/20261128120000_mova_app_v2.sql` uma vez.
2. **Auth:** em Authentication → URL Configuration, definir o Site URL como `https://hackasesporte.vercel.app`. Decidir se "Confirm email" fica ligado: o SMTP padrão do Supabase envia poucos emails por hora.
3. **Vercel:** `NEXT_PUBLIC_SUPABASE_URL` já está em Production. Falta `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a chave publicável, feita para o navegador). A service role não é usada pelo app v2.
4. Fazer merge na `main` e deploy.

## Fora desta versão
Gravação e medição pela câmera, gravação de atividades com moedas (função no servidor que valida as 3 tentativas e a nota mínima), conquista "missão cumprida", promoção semanal da liga.
