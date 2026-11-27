# MOVA Brasil
O jogo que acontece fora da tela. Salta. Evolui. Aparece.

Primeira fatia de implementação da Pessoa 2 (FE/BE, 24–26/11), em desenvolvimento. Consulte [plano mestre](MOVA_Brasil_Plano_Mestre_Desenvolvimento.md) e [design](MOVA_Brasil_Design_e_Interface.md).

## Executar localmente
Node 22+, npm. Na raiz:
```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```
Abra http://localhost:3000. Lockfile ainda não gerado: após primeira instalação bem-sucedida, revisar e versionar package-lock.json, e trocar CI para npm ci. Não há credenciais necessárias para o modo local.

## Fluxo demonstrável
Início → Missões → Demo → escolher replay sintético → cálculo server-side → Resultado → Passaporte / ranking de sessão → Lab. Caso inválido de pés cortados não recebe marca. Os eventos do catálogo são anotados sinteticamente; o replay usa landmarks gerados matematicamente, sem inferência real de vídeo. O ranking é uma simulação por protocolo com três perfis fictícios por esporte, sem grupos remotos de atletas. Histórico local é sessionStorage, não persistência remota. Nunca enviar score do cliente. Reset em Privacidade.

## Câmera e integração
Em ambiente privado protegido ou localhost, defina ENABLE_PRIVATE_CAPTURE=true em .env.local. Captura exige confirmação adulta; MediaPipe Lite carrega modelo/WASM versionados de CDN, processa vídeo local, desenha pose, limita tentativa a 5s e libera tracks. Ainda não integra o motor de salto CV12 nem envia resultados reais; não habilitar captura na demo pública. A implementação ainda precisa de teste de navegador e aparelho real; inferência no main thread é provisória, worker pendente. Contratos em src/contracts/attempt.ts são propostas para acordar com Pessoa 1.

## Supabase e Vercel
Veja [supabase/README.md](supabase/README.md) e .env.example. Não há projeto MOVA remoto configurado. Sem env, API calcula fixtures mas histórico é local; com env e schema aprovado, sessão usa cookie aleatório HttpOnly, hash, TTL de acesso e persistência idempotente. SQL é rascunho não aplicado. Nunca reutilizar banco de outro projeto nem expor service role. No Vercel, importar a branch/PR como preview e usar Node 22+; não promover sem build, testes, licenças e configuração aprovados. Não enviar dados reais.

## Status e limitações
Veja [registro das tarefas](docs/decisions/pessoa-2-24-26.md). Sem benchmark empírico, sem nota de atleta real, sem Ghost avançado, sem login adulto, sem deploy homologado. PWA tem manifest/ícone, instalação/offline ainda não homologados. Estilos em CSS com tokens do projeto; Tailwind, fontes hospedadas e lint ainda pendentes. Não foi alterado o plano mestre.

## Dependências e atribuições
Next.js, React e MediaPipe são projetos externos. Código novo de aplicação e fixtures esquemáticas desenvolvidos para MOVA; nenhum código das branches de pesquisa foi copiado. Conferir licenças de dependências/modelos/assets e registro de origem antes de submissão. [Documentação MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js).
