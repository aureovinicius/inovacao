# Crônicas da Copa — Game Design Document (GDD)

> **Título de trabalho:** *Crônicas da Copa* — *um RPG de mesa da Copa do Mundo*
> Alternativas: *Mundial D20* · *Copa Lendária* · *11 — Crônicas do Mundial*
>
> **Status:** planejamento (sem implementação). Documento vivo.
> **Base técnica:** este jogo nasce dentro do projeto *Copa 2026 · Dashboard*, reaproveitando seus dados, i18n, PWA e o padrão de proxy serverless.

---

## 1. Pitch (uma frase)

Um **simulador de futebol textual** no estilo Brasfoot **cruzado com um RPG de mesa**: você cria um personagem (jogador de uma posição **ou** técnico, como se fossem classes), escolhe sua seleção e **constrói sua própria história na Copa do Mundo** — narrada dinamicamente pela Claude API, como se houvesse um Mestre de RPG conduzindo a campanha. Decisões dentro e fora de campo, resolvidas com **rolagens de d20**, moldam seus atributos e o seu legado. Mesmo sem levantar a taça, você pode vencer a **sua** história: ser artilheiro, valorizar o passe, virar ídolo.

---

## 2. Pilares de design

1. **Sua história importa mais que o troféu.** O sucesso é plural: artilharia, assistências, defesas, virar zebra, redenção. O fim de campanha entrega um *epílogo personalizado*.
2. **Mestre vivo (IA narrativa).** A Claude API é o "Dungeon Master": gera cenas, dilemas, rivalidades e a crônica única de cada jogada — nunca duas campanhas iguais.
3. **Dado conta a verdade.** Toda decisão de peso passa por uma rolagem de **d20** com animação. Sorte e azar (crítico/falha crítica) fazem parte da fantasia.
4. **Partida Brasfoot + intervenções de RPG.** A partida roda como simulação textual; o jogador tem um **número limitado de intervenções** por jogo, que podem mudar o placar.
5. **Leve e acessível.** PWA textual, roda em qualquer celular, offline-first, multi-idioma. Educativo e gratuito, no espírito do projeto original.

---

## 3. Criação de personagem

O jogador define, no início:

| Etapa | Escolha | Efeito no jogo |
|---|---|---|
| **Nome** | livre | aparece na crônica, súmulas, manchetes |
| **Seleção** | uma das seleções reais (vinda de `data/teams.json`) | define força do time, escudo, cores, rival |
| **Classe** | posição em campo **ou** técnico | define atributos-chave, loop de jogo e métricas de êxito |
| **Origem (background)** | ex.: "cria da várzea", "joia da base", "veterano que voltou" | bônus/penalidade inicial + ganchos narrativos |
| **Tom da campanha** | realista · épico/lendário · cômico | calibra o estilo do Mestre (prompt da IA) |

### 3.1 Classes = posições (+ técnico)

Cada posição é uma "classe" com identidade, atributos-chave e **condição de êxito alternativa**:

| Classe | Arquétipo RPG | Atributos-chave | Êxito alternativo |
|---|---|---|---|
| **Goleiro** — *O Guardião* | Tanque/Clérigo | MEN, VIS | Luva de Ouro (menos gols sofridos), defesa de pênalti |
| **Zagueiro** — *A Muralha* | Defensor | FÍS, MEN | jogos sem sofrer gol, liderança |
| **Lateral** — *O Batedor* | Patrulheiro | FÍS, TÉC | participações em gol subindo a linha |
| **Volante** — *A Sentinela* | Guerreiro | FÍS, VIS | desarmes, "motor" do time |
| **Meia** — *O Maestro* | Mago/Bardo | TÉC, VIS | **valorizar o passe** (assistências), regente do jogo |
| **Ponta** — *O Flâmula* | Ladino | FÍS, TÉC | dribles, velocidade, jogadas decisivas |
| **Centroavante** — *O Artilheiro* | Combatente/DPS | TÉC, MEN | **artilharia** (Chuteira de Ouro) |
| **Técnico** — *O Estrategista* | "quase-Mestre" | VIS, CAR | gestão do elenco; loop próprio (escalação, esquema, substituições, leitura de jogo) |

> O **Técnico** tem um loop distinto: em vez de atuar em uma posição, ele faz escolhas de **escalação, esquema tático, preleção e substituições**, e suas intervenções na partida são ordens/ajustes em vez de lances individuais.

### 3.2 Atributos (os "stats" de RPG)

Seis atributos, ao estilo D&D, gerando **modificadores** para o d20:

- **TÉC — Técnica** (controle, finalização, precisão de passe)
- **FÍS — Físico** (fôlego, força, velocidade)
- **VIS — Visão de jogo** (inteligência, posicionamento, leitura)
- **MEN — Mentalidade** (frieza sob pressão, momentos decisivos)
- **CAR — Carisma/Liderança** (vestiário, imprensa, torcida)
- **SOR — Sorte/Fé** (o intangível; melhora chance de crítico, atenua falha crítica)

Distribuição inicial por *point-buy* ou rolagem (4d6 drop lowest), com bônus de classe e de origem.

---

## 4. Sistema de dados (d20)

Resolução central, idêntica à mesa:

```
rolagem = d20 + modificador de atributo (+ bônus de perícia/situação)
sucesso se rolagem ≥ CD (Classe de Dificuldade)
```

- **CD** varia com o contexto: força do adversário, momento do jogo, clima, torcida.
- **Crítico (20 natural):** efeito ampliado — golaço, defesaça, lance que vira a partida.
- **Falha crítica (1 natural):** gol contra, lesão, cartão, pênalti perdido.
- **Vantagem / Desvantagem** (rola 2d20, fica com o maior/menor): vem de **moral**, **fôlego**, **torcida (mando)**, **rivalidade**, **clima**, perks e traços.

### 4.1 Animação do d20

- Momento de escolha → tela escurece, **dado d20 3D** rola (CSS 3D transforms ou um `<canvas>` leve; sem dependência pesada).
- Mostra o número, soma os modificadores em *overlay*, revela sucesso/falha com cor (verde/vermelho) e *feedback* sonoro/háptico (vibração no mobile).
- Crítico e falha crítica têm animação especial (dourado / trinca vermelha).
- Acessibilidade: opção de "rolagem rápida" (sem animação) e leitura do resultado por texto.

---

## 5. A partida (Brasfoot + intervenções)

### 5.1 Motor de simulação (a base "Brasfoot")

- A partida é **simulada por eventos** (não em tempo real): o motor gera lances minuto a minuto a partir de **força dos times + ratings dos jogadores + fatores (mando, moral, cansaço)**.
- Saída em **texto narrado**, com placar, cronômetro e log de lances.
- O motor é **determinístico e testável** (semente de RNG), separado da camada de IA — o jogo funciona mesmo sem a Claude API (modo offline/barato).

### 5.2 Intervenções de RPG (o tempero)

- Durante a partida, o jogador tem um **número limitado de "Lances Decisivos"** (ex.: **3 por jogo**, escalando com nível/atributos/perks).
- Em um Lance Decisivo, a simulação **pausa**: o Mestre (IA) descreve a situação ("falta frontal aos 87'", "contra-ataque 2x1", "bola aérea na área"), o jogador **escolhe uma ação**, rola o **d20**, e o resultado **realimenta a simulação** (muda momento, probabilidade de gol, placar, e gera *deltas* de atributo/moral).
- **Economia de intervenção:** os Lances gastam um recurso (**Foco/Energia**), ligado ao fôlego — usar tudo cedo deixa o fim de jogo nas mãos do motor.
- Para o **Técnico**, as intervenções são **ajustes táticos / substituições / preleção**, com efeito coletivo.

### 5.3 Exemplo de fluxo de um Lance Decisivo

```
[78'] Empate em 1 a 1. A torcida adversária ruge. Você recebe na entrada da área,
      marcado por dois zagueiros.
  → A) Tentar o drible (TÉC, CD 15, gasta 1 Foco)
  → B) Tocar pro lateral e seguir (VIS, CD 10, seguro)
  → C) Finalizar de primeira (MEN, CD 17, alto risco/recompensa)

[jogador escolhe C] → 🎲 d20 = 18 + MEN(+3) = 21 ≥ 17  →  SUCESSO
"Você ajeita o corpo e solta um voleio no ângulo. GOOOL! 2 a 1!"
  Efeitos: +1 gol; +moral do time; +XP; progresso na conquista 'Artilheiro'.
```

---

## 6. O Mestre (integração com a Claude API)

A IA é o coração da rejogabilidade. Ela atua como **narrador/Mestre de RPG**.

### 6.1 O que a IA gera

- **Cenas fora de campo:** vestiário, coletiva de imprensa, treino, relação com companheiros e técnico, dramas de bastidor.
- **Dilemas narrativos** com escolhas que mexem em atributos/moral/relações (a parte "tabletop").
- **Lances Decisivos contextuais** durante a partida (descrição + opções + CD sugerida).
- **Crônica da campanha:** um diário/jornal escrito pela IA, único a cada jogada.
- **Epílogo/legado** ao fim da campanha — a "ficha de aposentadoria" do personagem.

### 6.2 Arquitetura (reaproveitando o que você já tem)

```
  App (PWA)  ──►  Cloudflare Worker (chave ANTHROPIC fica aqui)  ──►  Claude API
     ▲                         │
     └───────── JSON estruturado (narrativa + efeitos mecânicos)
```

- **Mesmo padrão do seu `worker/live-proxy.js`:** a chave nunca vai ao navegador. Adicionar uma rota `/mestre` (ou um Worker novo) que recebe o **estado do jogo** e devolve a narrativa.
- **Saída estruturada (tool use / JSON):** a IA retorna `{ narrativa, opcoes[], cd, efeitos: { stat_deltas, moral, conquistas } }`, para o motor aplicar de forma confiável — texto bonito **e** mecânica parseável.
- **Continuidade (memória de campanha):** a cada chamada envia-se um *story state* compacto (ficha, atributos, histórico de decisões, relações, conquistas, contexto do jogo). É o "resumo da sessão" que mantém o Mestre coerente.
- **Custo & latência:**
  - **Modelo rápido (Haiku)** para Lances Decisivos frequentes; **modelo forte (Sonnet/Opus)** para grandes momentos (abertura de capítulo, final, epílogo).
  - **Prompt caching** do *system prompt* + "bíblia do mundo" (regras, tom, glossário) para baratear.
  - **Cota/limite por sessão** e *rate limit* no Worker.
  - **Fallback offline:** uma biblioteca de eventos pré-escritos (templates) cobre quando não há API/cota — o jogo nunca trava.
  - Opção *traga-sua-chave* (BYO key) para usuários avançados.

### 6.3 Guarda-corpos

- A IA **propõe** narrativa e CD; o **motor valida e aplica** os efeitos (a IA não decide sozinha o placar — evita exploits e mantém o balanceamento).
- Limites de *tokens* e de número de chamadas por partida.

---

## 7. Níveis = eras da Copa (dificuldade pelo nº de seleções)

Cada "fase/nível" é uma **Copa do Mundo diferente**; menos seleções = mais fácil, mais seleções = mais difícil. Também rende um charme **histórico/educativo** alinhado ao projeto original.

| Era (exemplo) | Seleções | Dificuldade | Sabor |
|---|---|---|---|
| **1930 / 1950** | 13 | Fácil | pioneirismo, futebol "romântico" |
| **1982** | 24 | Média | era clássica, primeira com 24 |
| **1998–2022** | 32 | Difícil | era moderna |
| **2026** | **48** | Muito difícil | seu cenário-base, com os dados reais |

- Progressão estilo **carreira**: avança pelas eras desbloqueando a próxima, **ou** escolhe uma campanha avulsa.
- Dificuldade também sobe com: **força dos adversários**, **CDs mais duras**, **menos intervenções**.
- **Licenciamento:** seleções (nações) são reais; para nomes de **jogadores reais** há questão de direitos — recomenda-se **protagonista fictício** + elenco genérico, com contexto histórico evocado sem copiar escalações. (Sinalizar antes de implementar.)

---

## 8. Conquistas (achievements)

Sistema de medalhas que dá XP, títulos e desbloqueios. Exemplos:

- ⚽ **Primeiro Gol** · 🎩 **Hat-trick** · 💥 **Goleada** (vencer por ≥4)
- 🅰️ **Garçom** (X assistências) · 👑 **Chuteira de Ouro** (artilheiro do torneio)
- 🧤 **Luva de Ouro** · 🧱 **Muralha** (jogos sem sofrer gol)
- 🦓 **Zebra** (bater um favorito) · 🥂 **Cinderela** (avançar como azarão)
- 🎯 **Pé de Anjo** (nota de craque do jogo) · ❤️ **Coração Valente** (vice com honra)
- 🏆 **Campeão do Mundo** · 🐐 **Lenda** (meta-conquista de carreira)
- Conquistas de **escolha**: "Capitão Nato", "Pavio Curto", "Catimbeiro", "Cavalheiro" — viram **traços** que afetam dados.

Tela de **Legado/Hall da Fama** persistente entre campanhas.

---

## 9. Progressão e personagem ao longo do tempo

- **XP** de partidas e conquistas → **subir de nível** → pontos para distribuir em atributos (leveling de RPG).
- **Árvore de perks por classe:** "Cobrança de falta", "Frieza no pênalti", "Líder de vestiário", "Voleio", "Catimba", "Leitura de jogo".
- **Traços e defeitos** ganhos por decisões (ex.: *Pavio Curto* → desvantagem em disciplina, vantagem em intensidade).
- **Sistemas de tempero que modulam os dados:** moral pessoal, moral do time, **favor da torcida**, confiança do técnico, **rivalidades**, clima/fuso (dá pra usar as 16 cidades-sede do seu roadmap!).

---

## 10. Decisões fora de campo (o lado "mesa")

Entre as partidas, cenas de escolha conduzidas pela IA:

- imprensa e redes sociais, intensidade de treino, vida pessoal, lesão e recuperação, conflito de vestiário, propostas/contrato.
- Cada escolha desloca atributos/moral/relações e **abre ramos de história** — é onde mora a sensação de RPG de mesa.

---

## 11. UX / Telas principais

1. **Criação de personagem** (nome, seleção, classe, origem, tom)
2. **Mapa de campanha** (chaveamento da Copa da era escolhida)
3. **Hub pré-jogo** (cenas de bastidor, escalação/preparo)
4. **Partida** (log narrado + cronômetro + placar + botão de Lance Decisivo)
5. **Overlay de rolagem d20** (animação + modificadores + resultado)
6. **Diário/Crônica** (texto da IA, navegável como um livro)
7. **Ficha do personagem** (atributos, perks, traços, conquistas)
8. **Legado / Hall da Fama** (epílogo + carreira)

---

## 12. Tecnologia (proposta)

- **Manter PWA, offline-first, sem fricção** — coerente com o projeto atual.
- **Separação de camadas (recomendado):**
  - `engine/` — JS puro, determinístico, testável (dados, simulação de partida, regras). Sem DOM, sem IA.
  - `mestre/` — serviço que fala com o Worker/Claude e devolve JSON estruturado.
  - `ui/` — telas e a animação do d20.
- **Framework:** dá pra ficar em **vanilla** (sem build, fiel ao projeto) ou adotar algo enxuto (**Preact/Svelte**) se aceitar um passo de build. Recomendação: **começar vanilla** no protótipo do motor; reavaliar quando a UI crescer.
- **Persistência:** `localStorage`/**IndexedDB** guardando a ficha + crônica + progresso.
- **Reaproveitar do projeto atual:** `data/teams.json` (48 seleções, escudos, cores, técnicos), **i18n** (4 idiomas — o Mestre pode narrar no idioma do jogador!), **service worker**/PWA, **Capacitor** (vira app de loja), padrão do **Worker** para a chave secreta.

---

## 13. Modelo de dados (rascunho)

```jsonc
// personagem (save)
{
  "id": "uuid",
  "nome": "Tião da Vila",
  "selecaoId": 758,            // referencia data/teams.json
  "classe": "centroavante",
  "origem": "cria_da_varzea",
  "tom": "epico",
  "nivel": 4,
  "xp": 1280,
  "atributos": { "TEC": 14, "FIS": 12, "VIS": 11, "MEN": 16, "CAR": 13, "SOR": 9 },
  "perks": ["frieza_no_penalti", "voleio"],
  "tracos": ["pavio_curto"],
  "moral": 0.7,
  "favorTorcida": 0.5,
  "relacoes": { "tecnico": 0.6, "camisa10": 0.8 },
  "conquistas": ["primeiro_gol", "hat_trick"],
  "campanha": { "era": 2026, "fase": "oitavas", "jogos": [/* ... */] },
  "cronica": [ /* trechos narrados pela IA, em ordem */ ]
}
```

```jsonc
// resposta estruturada do Mestre (IA)
{
  "narrativa": "Aos 78', o estádio inteiro contra você...",
  "opcoes": [
    { "id": "A", "texto": "Tentar o drible", "stat": "TEC", "cd": 15, "custoFoco": 1 },
    { "id": "B", "texto": "Tocar e seguir",  "stat": "VIS", "cd": 10, "custoFoco": 0 },
    { "id": "C", "texto": "Finalizar de primeira", "stat": "MEN", "cd": 17, "custoFoco": 1 }
  ],
  "efeitosPorResultado": {
    "sucesso": { "gol": true, "moral": +0.1, "xp": 50, "conquistaProgresso": "artilheiro" },
    "falha":   { "moral": -0.05, "fadiga": +0.1 },
    "critico": { "gol": true, "moral": +0.2, "xp": 120, "conquista": "golaco" },
    "falhaCritica": { "lesao_risco": 0.2, "moral": -0.15 }
  }
}
```

---

## 14. Roadmap por fases (MVP → completo)

- **Fase 0 — Núcleo jogável (sem IA).** Motor de partida determinístico + sistema de d20 + 1 classe (centroavante) + 1 era. Lances Decisivos com **eventos pré-escritos**. Prova o *loop* e o "gostinho".
- **Fase 1 — Mestre IA.** Worker `/mestre` + saída estruturada + diário/crônica + memória de campanha. Haiku para lances, modelo forte para grandes momentos.
- **Fase 2 — Conteúdo.** Todas as classes (incl. técnico), múltiplas eras, conquistas, progressão/perks, decisões de bastidor.
- **Fase 3 — Polimento.** Animação d20 caprichada, áudio/háptico, i18n (4 idiomas), PWA/mobile (Capacitor), Hall da Fama.
- **Fase 4 — Extras.** Modo carreira multi-era, eventos sazonais, rivalidades persistentes, compartilhar a crônica como "figurinha"/imagem.

---

## 15. Riscos & mitigação

| Risco | Mitigação |
|---|---|
| **Custo da Claude API** | modelo barato p/ lances frequentes, prompt caching, cota por sessão, fallback offline, BYO key |
| **Latência da IA na partida** | pré-buscar o próximo lance, *streaming*, animação do d20 mascara a espera |
| **IA "trapaceando" no placar** | motor valida/aplica efeitos; IA só propõe |
| **Licenciamento de jogadores reais** | protagonista fictício + elenco genérico; nações reais ok |
| **Escopo grande** | MVP de 1 classe/1 era primeiro; cortar cedo |
| **Balanceamento (sorte vs. skill)** | semente de RNG testável; telemetria de winrate por classe/era |

---

## 16. Perguntas em aberto (decisões do produto)

1. **Tom principal:** focar realista, épico/lendário ou cômico — ou deixar o jogador escolher desde já?
2. **Custo da IA:** cota grátis diária, BYO key, ou um modelo híbrido?
3. **Stack:** seguir 100% vanilla (sem build) ou aceitar Preact/Svelte quando a UI crescer?
4. **Primeira fatia (MVP):** confirmar "1 classe + 1 era + lances pré-escritos" como Fase 0.
5. **Eras de lançamento:** quais Copas entram primeiro (sugestão: 2026 como base + uma era "fácil" histórica)?

---

*Documento de planejamento. Sem implementação nesta etapa.*
