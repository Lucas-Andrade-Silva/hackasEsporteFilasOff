# MOVA Brasil: design e interface

> Documento separado do [projeto completo](MOVA_Brasil_Projeto_Completo_Hack_Brasil_2026.md). Reúne marca, cores, tipografia, usabilidade e telas.

| Campo | Definição |
|---|---|
| Versão | 1.0 (saiu da seção 11 e da tabela de telas da seção 8 do projeto v4.0) |
| Data | 19/11/2026 |
| Público | Jovem de 18 a 24 anos que joga vôlei ou basquete de forma amadora (ICP, seção 3.2 do projeto) |

## Sumário

1. [Para quem desenhamos](#1-para-quem-desenhamos)
2. [Personalidade da marca](#2-personalidade-da-marca)
3. [Paleta](#3-paleta)
4. [Tipografia](#4-tipografia)
5. [Usabilidade](#5-usabilidade)
6. [Telas](#6-telas)
7. [Momentos-chave da interface](#7-momentos-chave-da-interface)
8. [O que evitar](#8-o-que-evitar)
9. [Checklist de design](#9-checklist-de-design)

---

## 1. Para quem desenhamos

- Jovem de 18 a 24 anos com **Android de entrada**, muitas vezes com plano pré-pago (TIC Domicílios 2024, fonte F20 do projeto).
- Usa o app **ao ar livre ou em quadra**, com muita luz e pouca atenção, muitas vezes **com uma mão só**.
- Durante a captura, o celular fica **apoiado longe**, a 2 ou 3 metros.
- Público misto, com forte presença feminina no vôlei: 57% dos praticantes de vôlei, basquete e handebol são mulheres (PNAD 2015, fonte F19). O visual é esportivo, mas **não agressivo nem só masculino**.

## 2. Personalidade da marca

**Energia de quadra, honestidade de laboratório.** O app vibra quando o atleta salta, mas mostra a margem de erro sem esconder nada.

Verbos: **Salta. Evolui. Aparece.**

## 3. Paleta

Contraste calculado pela fórmula WCAG.

**Tema escuro (padrão; destaca o esqueleto e economiza bateria em tela OLED):**

| Papel | Cor | Hex | Contraste sobre o fundo #0E1A2B |
|---|---|---|---|
| Fundo "Noite de quadra" | azul-tinta | `#0E1A2B` | — |
| Superfície (cartões) | azul-quadra | `#16263D` | — |
| Texto principal | branco gelo | `#F5F7FA` | 16,3 : 1 ✅ |
| Texto secundário | cinza-azulado | `#9AA8BC` | 7,2 : 1 ✅ |
| **Ação principal** (botões, recorde, esqueleto atual) | **lima** | `#C6F432` | 13,6 : 1 ✅ (texto do botão em `#0E1A2B`) |
| Destaque basquete (tentativa anterior no Ghost) | laranja-bola | `#FF7A1A` | 6,7 : 1 ✅ |
| Destaque vôlei | azul-rede | `#4D8DFF` | 5,5 : 1 ✅ |
| Erro e rejeição | coral | `#FF5A5F` | 5,7 : 1 ✅ |

**Tema claro (para sol forte na quadra):**

| Papel | Hex | Contraste sobre `#FFFFFF` |
|---|---|---|
| Fundo | `#FFFFFF` | — |
| Texto principal | `#0E1A2B` | 17,5 : 1 |
| Texto secundário | `#5B6B80` | 5,4 : 1 |
| Verde de ação | `#3F6212` | 7,1 : 1 |
| Laranja | `#C2410C` | 5,2 : 1 |
| Azul | `#1D4ED8` | 6,7 : 1 |

No tema claro, o lima aparece só como fundo de botão, com texto escuro.

**Regras:**
- Todas as combinações acima passam o nível AA (4,5 : 1).
- **Nunca usar só a cor** para dar uma informação: válido e rejeitado também têm ícone e texto.
- Cada esporte tem sua cor de destaque, mas a ação principal é sempre lima, para o usuário aprender um só "botão de agir".

## 4. Tipografia

- Títulos e números: **Barlow Condensed** (Google Fonts), condensada e esportiva, boa para números grandes de placar.
- Texto: **Inter** (Google Fonts), muito legível em tela pequena.
- O número do resultado aparece **gigante** (48 a 64 px), com a unidade e a margem logo abaixo: "**42 cm** ± 3 cm".

## 5. Usabilidade

1. **Primeira missão em menos de 2 minutos** [META]. Sem cadastro para testar; o cadastro vem depois do primeiro salto.
2. **Botões grandes**, com no mínimo 48 × 48 px, e ação principal na parte de baixo da tela (zona do polegar).
3. **Captura a distância:** como o celular fica longe, o app fala em voz e mostra um **semáforo grande** (vermelho: "afaste-se"; amarelo: "pés fora do quadro"; verde: "pode saltar") e faz **contagem regressiva sonora**. Isso evita voltar ao celular entre tentativas.
4. **Silhueta-guia** desenhada na câmera mostrando onde o corpo deve ficar.
5. **Erros que ensinam:** em vez de "falha", dizer "seus pés saíram do quadro: dê um passo para trás".
6. **Leve:** modelo Lite ou Full do MediaPipe (3 a 6 MB), baixado uma vez, e telas que funcionam com rede fraca.
7. **Margem de erro sempre visível**, com explicação em uma frase: "celulares a 30 fps medem com mais variação".
8. **Sem pressão:** nada de "você perdeu sua sequência!". Conquistas celebram presença e evolução.
9. **Acessibilidade:** textos alternativos, navegação por leitor de tela nas telas fora da captura, legenda nos áudios e alternativa de exercício.

## 6. Telas

| Tela | Conteúdo | Estado vazio ou erro |
|---|---|---|
| Início | Missão da semana, botão grande "Começar", acesso à demo | Primeiro desafio sugerido |
| Escolha do esporte | Vôlei ou basquete | — |
| Captura | Câmera, silhueta-guia, semáforo de enquadramento | Sem câmera: oferece a demo |
| Resultado | Altura, margem de erro, selo e próxima ação | Rejeição com motivo e dica |
| Ranking | Abas de desempenho, evolução e grupo | Grupo pequeno: não fala em "nacional" |
| Ghost Mode | Duas tentativas sobrepostas | Sem histórico: "faça mais uma tentativa" |
| Passaporte | Histórico e recordes | Primeira tentativa vira a linha de base |
| MOVA Lab | Método, erro e limites | Métrica não medida aparece como "pendente" |
| Privacidade | O que guardamos e como apagar | — |

A jornada completa (do convite ao ranking) está na seção 8 do projeto.

## 7. Momentos-chave da interface

| Momento | Desenho |
|---|---|
| Captura | Tela cheia escura, esqueleto em lima sobre o vídeo, semáforo no topo, contador grande no centro |
| Resultado | Número gigante, uma animação curta de "subida" do valor, selo de qualidade e dois botões: "Tentar de novo" e "Ver ranking" |
| Ghost Mode | Esqueleto atual em lima, anterior em laranja (basquete) ou azul (vôlei), linha do pico de cada um e diferença em cm |
| Ranking | Três abas (Desempenho, Evolução, Grupo); a posição do usuário fica sempre fixa na tela, mesmo rolando |
| Recorde pessoal | Confete discreto e vibração, só se o ganho superar a margem de erro |

## 8. O que evitar

- Corpos "perfeitos" em ilustrações.
- Linguagem de humilhação ("fraco").
- Excesso de neon, que cansa e prejudica o contraste.
- Telas cheias de números.
- Animações pesadas que travam o Android de entrada.

## 9. Checklist de design

- [ ] Contraste AA conferido nos dois temas.
- [ ] Teste em Android de entrada, ao ar livre.
- [ ] Captura feita sem tocar no celular depois de apoiar.
- [ ] Todo estado de erro com motivo e próxima ação.
- [ ] Nenhuma informação passada só por cor.
