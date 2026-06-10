# ⚽🎲 Lendas da Copa — Game Design Document (GDD)

> **Simulador textual de futebol estilo Brasfoot + RPG de mesa narrado por IA.**
> O jogador cria um personagem (jogador de linha, goleiro ou técnico), escolhe uma seleção
> e vive uma campanha de Copa do Mundo onde cada decisão — resolvida com um **d20** —
> molda uma história única gerada pela **Claude API**, como se houvesse um mestre de mesa
> conduzindo a partida.

**Status:** planejamento (nenhuma linha de código do jogo ainda)
**Projeto-mãe:** [Painel da Copa · 2026](../README.md) — reaproveita dados de seleções,
elencos e estrutura PWA já existentes.

---

## 1. Visão Geral

| | |
|---|---|
| **Nome de trabalho** | Lendas da Copa (alternativas: "Minha Copa", "Craque de Mesa") |
| **Gênero** | Simulador de futebol textual + RPG narrativo |
| **Plataforma** | Web (PWA) + Android via Capacitor (mesma stack do dashboard) |
| **Sessão típica** | 1 partida = 10–15 min; 1 campanha (Copa inteira) = 1h30–3h |
| **Público** | Fãs de Brasfoot/Elifoot, jogadores de RPG de mesa, torcedores |
| **Referências** | Brasfoot, Elifoot, Football Manager (modo treinador), Disco Elysium (testes de habilidade narrativos), AI Dungeon (narrativa por IA), Blaseball (absurdo emergente) |

### O fantasma que o jogo combate

Em simuladores tradicionais, perder a Copa = campanha "fracassada". Aqui **a história é a
recompensa**: mesmo eliminado na fase de grupos, o jogador pode terminar como artilheiro,
ídolo da torcida, protagonista de uma rivalidade, ou autor de "o gol que o mundo nunca
esqueceu". O sistema de conquistas e o epílogo narrado pela IA garantem que toda campanha
gere uma lenda — boa ou trágica.

---

## 2. Pilares de Design

1. **Toda campanha vira uma história contável.** A IA narra como um mestre de mesa: com
   memória, consequência e drama. Ao final, o jogador recebe a "crônica da sua Copa".
2. **O dado é sagrado.** Decisões importantes passam por uma rolagem de d20 visível e
   animada. O jogador sente o risco antes do resultado.
3. **Brasfoot no esqueleto, RPG no coração.** A simulação da partida é determinística e
   barata (roda local, sem IA). A IA entra nos **momentos de intervenção** — limitados,
   valiosos, dramáticos.
4. **Derrota ≠ fracasso.** Objetivos paralelos (artilharia, valorização, redenção pessoal)
   e conquistas dão vitórias mesmo sem o caneco.
5. **Custo de IA sob controle.** Cada chamada à API tem propósito; a mecânica funciona
   offline/sem IA em modo degradado (textos de template).

---

## 3. Criação de Personagem

### 3.1 Identidade
- **Nome** (livre) + apelido opcional (a IA usa o apelido nas narrações: "Lá vem o *Furacão*…")
- **Seleção**: qualquer uma das presentes na edição da Copa escolhida (dados reais do
  `data/teams.json` para 2026; tabelas históricas para edições antigas)
- **Idade/arquétipo de carreira** (afeta narrativa e stats iniciais):
  - *Promessa* (17–20): stats menores, maior crescimento por partida
  - *Auge* (24–28): stats equilibrados
  - *Última dança* (33+): stats altos em mental, físico decai; narrativa de despedida

### 3.2 Classes (posição em campo = classe de RPG)

| Classe | Fantasia | Stat primário | Habilidade de classe (exemplos) |
|---|---|---|---|
| **Goleiro** | O muro, o pênalti-defendido | Reflexo | *Paredão*: 1×/partida, vantagem (rola 2d20, usa o maior) numa defesa |
| **Zagueiro** | O xerife, o gol de cabeça aos 90' | Força | *Carrinho Limpo*: anula um contra-ataque sem risco de cartão |
| **Lateral** | O motorzinho, a ultrapassagem | Fôlego | *Apoio Total*: cria chance extra, mas deixa espaço (risco narrativo) |
| **Volante** | O cão de guarda, o maestro invertido | Visão | *Leitura de Jogo*: revela a "intenção" da IA adversária no próximo lance |
| **Meia** | O camisa 10, o passe açucarado | Técnica | *Enfiada de Bola*: converte posse em chance clara |
| **Atacante** | O artilheiro, o matador | Finalização | *Faro de Gol*: rerola um chute falhado (1×/partida) |
| **Técnico** 🎩 | O estrategista — controla o time inteiro | Carisma | *Preleção*: buff coletivo no 1º tempo; *Grito da Beira do Campo*: muda tática sem gastar intervenção |

> **Técnico é a "classe avançada"**: em vez de viver lances individuais, gerencia
> escalação, tática, substituições e o vestiário (conflitos de elenco narrados pela IA).
> Mais próximo do Brasfoot puro; as outras classes são mais "Disco Elysium de chuteira".

### 3.3 Atributos (escala 1–20, casa com o d20)

**Físicos/técnicos:** Finalização · Passe · Drible · Desarme · Reflexo (GK) · Fôlego
**Mentais (o diferencial RPG):** Frieza (pênaltis, minutos finais) · Liderança (afeta o
time) · Estrela (chance de momentos mágicos) · Disciplina (risco de cartão/expulsão)

- Distribuição inicial por pontos (point-buy) + bônus/ônus do arquétipo de idade.
- **Teste padrão: d20 + (atributo − 10) ≥ Dificuldade (CD).** Regra simples, transparente,
  mostrada na UI a cada rolagem.
- **20 natural = momento épico** (a IA narra um lance histórico, conquista possível).
  **1 natural = desastre** (frango, pênalti cometido, lesão leve…) — também vira história.

---

## 4. Loop de Jogo

```
Escolher edição da Copa (nível) ─► Criar personagem ─► Convocação/Grupo
        │
        ▼
  ┌─ CICLO POR RODADA ──────────────────────────────────────────┐
  │ 1. PRÉ-JOGO (narrativa IA): vestiário, imprensa, evento      │
  │    de campanha (decisão com d20 que afeta stats/moral)       │
  │ 2. PARTIDA (engine local estilo Brasfoot, texto minuto a     │
  │    minuto) + N INTERVENÇÕES RPG (d20 + narração IA)          │
  │ 3. PÓS-JOGO: notas, XP, conquistas, manchete gerada pela IA  │
  │ 4. ENTRE JOGOS: treino (alocar XP), evento de elenco,        │
  │    tabela do grupo atualizada                                │
  └──────────────────────────────────────────────────────────────┘
        │
        ▼
  Mata-mata (intervenções valem mais, prorrogação, pênaltis)
        │
        ▼
  EPÍLOGO: crônica final da campanha gerada pela IA + galeria
  de conquistas + card compartilhável ("Minha Copa de 2026")
```

---

## 5. A Partida (engine estilo Brasfoot)

### 5.1 Simulação base (local, sem IA, custo zero)

- Motor determinístico com seed: compara forças (overall da seleção real, ajustado por
  tática, moral e atuação do personagem), gera eventos minuto a minuto.
- **Feed textual** clássico: `23' Chute de fora da área… defendeu o goleiro!`, com
  velocidade ajustável (1×/2×/4×/pular para o próximo evento).
- Eventos com **peso narrativo** são marcados como "ganchos" — candidatos a intervenção.
- Forças das seleções vêm dos dados reais já coletados pelo projeto
  (`teams.json`, `standings.json`, `scorers.json`; o `predict.mjs` já calcula forças —
  reaproveitar!).

### 5.2 Intervenções RPG (o coração do jogo)

- O jogador tem **Pontos de Garra** limitados por partida (padrão: **3** na fase de
  grupos, **4** no mata-mata; modificáveis por Liderança/eventos).
- Quando surge um gancho (ou quando o jogador aperta "ENTRAR NO LANCE"), o jogo pausa e
  apresenta **2–4 escolhas** geradas pela IA conforme o contexto:

> **78' — Empate em 1×1, escanteio a favor.**
> 🎲 *O cruzamento vem na sua direção…*
> 1. **Subir de cabeça por cima do zagueiro** (Finalização, CD 14)
> 2. **Ajeitar de peito para o companheiro** (Passe, CD 10 — risco menor, glória menor)
> 3. **Tentar a bicicleta** (Estrela, CD 18 — épico ou ridículo, sem meio-termo)

- O jogador escolhe → **animação do d20** → resultado mecânico aplicado ao placar/estado
  → **IA narra o desfecho** em 2–4 frases, no tom de locutor + mestre de mesa.
- Margem importa: passar da CD por 5+ = sucesso crítico (efeitos extras); falhar por 5+ =
  complicação (contra-ataque, cartão, queda de moral).
- **Consequência nos stats:** escolhas arriscadas repetidas sobem *Estrela* e descem
  *Disciplina*; jogar simples sobe *Frieza*; etc. O personagem vira o que o jogador joga.

### 5.3 Animação do d20

- Dado 3D-fake em CSS/Canvas (sem lib pesada): rolagem ~1,2 s com easing, tremor de tela
  em 20/1 natural, som de dado de resina (opcional, mudo por padrão).
- Mostra a conta na tela: `🎲 14 + 3 (Finalização) = 17 vs CD 14 → SUCESSO`.
- Acessibilidade: modo "resultado instantâneo" para quem não quer animação.

### 5.4 Momentos especiais

- **Pênaltis** (cobrança e disputa): sempre interativos, não gastam Garra — duelo de
  Frieza vs Reflexo do goleiro adversário, com narração da IA lance a lance.
- **Lesão/cartão do personagem:** vira evento narrativo (jogar no sacrifício? CD alta
  com risco de agravar).
- **Clássicos e rivalidades:** a IA recebe contexto histórico (ex.: Brasil×Argentina) e
  aumenta a temperatura da narração; CDs sobem ("o peso da camisa").

---

## 6. Níveis = Edições da Copa

A dificuldade nasce naturalmente do formato histórico — menos seleções, menos jogos até o título:

| Nível | Edição | Formato | Por que esse nível |
|---|---|---|---|
| 🟢 **Iniciante** | **1930 (Uruguai)** | 13 seleções, 3–4 jogos até o título | Curto, perdoa erros, ótimo tutorial. Narrativa "futebol de pioneiros" (sem substituições! vira mecânica: lesão = jogar com 10) |
| 🟢 Fácil | 1950 (Brasil) | 13 seleções, quadrangular final | Campanha do Maracanazo — material narrativo riquíssimo |
| 🟡 Médio | 1970 (México) | 16 seleções | A Copa "romântica"; 6 jogos até o título |
| 🟡 Médio+ | 1994 (EUA) | 24 seleções | Introduz fase de 16-avos, pênaltis decisivos |
| 🟠 Difícil | 2014 (Brasil) | 32 seleções, 7 jogos | Formato moderno completo |
| 🔴 **Lendário** | **2026 (EUA/CAN/MEX)** | **48 seleções**, até 8 jogos, grupos de 4 + 32-avos | Campanha mais longa do jogo; usa os dados reais e ao vivo do dashboard |

- Cada edição tem **modificadores de época** (sem substituição em 1930, bola pesada,
  sem cartão amarelo até 1970…) que viram regras e tempero narrativo.
- **Desbloqueio:** terminar qualquer campanha (mesmo eliminado) desbloqueia a próxima
  faixa; títulos desbloqueiam modos extras (ver §10).
- Edições históricas usam tabelas estáticas embutidas (seleções e forças aproximadas);
  **2026 usa o pipeline de dados real do projeto** — joga-se a Copa "de verdade".

---

## 7. Sistema de Conquistas

Categorias (exemplos — meta inicial: ~60 conquistas):

**Progressão**
- 🏅 *Estreia* — jogue sua primeira partida
- 🏅 *Sobrevivente* — passe da fase de grupos
- 🏅 *Semana mágica* — chegue à semifinal
- 🏆 *Campeão do Mundo* — vença uma campanha (1 variante por edição)

**Façanhas de partida**
- ⚽ *Primeiro grito* — primeiro gol do personagem
- ⚽ *Hat-trick* — 3 gols na mesma partida
- 🥅 *Goleada* — vença por 4+ de diferença
- 🧤 *Muralha* — goleiro: 3 jogos seguidos sem sofrer gol
- 🎲 *Abençoado* — tire dois 20 naturais na mesma partida
- 💀 *Maldito* — tire 1 natural na final… e veja o que acontece

**Carreira/história (o diferencial RPG)**
- 📈 *Valorizado* — termine a Copa com stat 5+ pontos acima do inicial
- 👑 *Artilheiro* — termine como goleador da edição
- 🎭 *Vilão e herói* — erre um pênalti e marque o gol da vitória na mesma campanha
- 🗞️ *Capa de jornal* — protagonize 5 manchetes geradas pela IA
- 🇺🇾 *Fantasma do Maracanã* — vença 1950 com o Uruguai... ou reescreva a história com o Brasil
- 🤝 *Zebra suprema* — seja campeão com uma seleção fora do top-30 do ranking

Conquistas são gravadas com **contexto** (data, edição, seleção, trecho da narração) —
a galeria é um "museu da carreira" do jogador.

---

## 8. Integração com a Claude API (o Mestre de Mesa)

### 8.1 Princípio de arquitetura

> **A engine decide O QUE acontece (mecânica, dados, placar). A IA decide COMO contar
> (narrativa) e O QUE OFERECER (opções de escolha).**

Isso mantém o jogo justo (a IA não "rouba" resultados), barato (poucas chamadas) e
resiliente (sem rede → templates locais assumem a narração).

### 8.2 Onde a IA entra (chamadas por campanha)

| Momento | Chamadas | O que gera |
|---|---|---|
| Pré-jogo | 1/jogo | Cena de vestiário/imprensa + evento de decisão com 2–3 opções |
| Intervenção | até 3–4/jogo | As opções do lance (com stat e CD sugeridos) + narração do desfecho após a rolagem |
| Pós-jogo | 1/jogo | Manchete + resumo de 1 parágrafo + nota narrativa do personagem |
| Evento entre jogos | ~1 a cada 2 jogos | Drama de elenco, entrevista, decisão de treino |
| Epílogo | 1/campanha | A crônica da campanha (usa o histórico inteiro resumido) |

Estimativa: **40–60 chamadas por campanha completa** de 2026 (8 jogos), bem menos nas
edições curtas.

### 8.3 Forma das chamadas (decisões técnicas)

- **Modelo:** `claude-opus-4-8` (padrão atual da plataforma; narração rica e consistente).
  O custo fica na casa de **centavos de dólar por campanha** com as otimizações abaixo;
  se quiser baratear depois, dá para rotear momentos de baixo impacto (manchetes,
  eventos menores) para um modelo menor — decisão de produto, não de arquitetura.
- **Structured outputs** (`output_config.format` com JSON Schema): cada resposta volta
  num formato fixo, por exemplo:

  ```json
  {
    "narracao": "string (2-4 frases, tom locutor + mestre de mesa)",
    "opcoes": [
      { "texto": "string", "atributo": "finalizacao|passe|...", "cd": 5-20, "tags": ["arriscada","epica"] }
    ],
    "efeitos": { "moral": -2..2, "stats": {"estrela": 0..1}, "flags": ["rivalidade_argentina"] }
  }
  ```

  → o jogo nunca depende de "parsear texto solto" da IA; a mecânica continua nas mãos da engine.
- **Prompt caching:** o system prompt (persona do mestre + regras do jogo + ficha do
  personagem) fica estável e cacheado; só o estado da partida e o lance atual variam por
  chamada — corta o custo de input em ~90% nas chamadas seguidas de uma mesma partida.
- **Streaming:** a narração aparece palavra a palavra, como locução — ótimo para o clima
  e percebe-se menos a latência.
- **Memória da campanha:** um "diário" resumido (JSON local) com fatos canônicos —
  gols, rivalidades, promessas feitas no vestiário, apelidos que pegaram — é enviado a
  cada chamada para a IA manter continuidade (o mestre "lembra" da campanha).
- **Fallback offline:** banco de ~200 templates de narração por tipo de evento. Sem rede
  ou sem créditos, o jogo continua jogável (com aviso "modo clássico").

### 8.4 Segurança da chave (obrigatório)

A chave da API **nunca** vai no cliente (PWA é código aberto no navegador). Reaproveitar
o padrão que o projeto já tem com o **Cloudflare Worker** (`worker/live-proxy.js`):

```
PWA (cliente) ──► Cloudflare Worker "/narrar" ──► Claude API
                  · guarda a ANTHROPIC_API_KEY como secret
                  · valida/limita o payload (só os tipos de chamada do jogo)
                  · rate-limit por IP/dispositivo (ex.: 10 chamadas/min)
                  · cache de respostas idênticas (epílogos de demo, etc.)
```

Isso também abre caminho para, no futuro, um modo "traga sua própria chave" (BYOK) para
usuários avançados, sem custo para você.

### 8.5 Tom da narração (prompt de persona — rascunho)

> "Você é o mestre de uma mesa de RPG sobre futebol e também locutor apaixonado. Narre em
> português brasileiro, no presente, em 2–4 frases. Use o apelido do personagem. Misture
> emoção de rádio (anos compatíveis com a edição da Copa) com consequência de RPG: todo
> sucesso planta a próxima ameaça, toda falha planta uma chance de redenção. Nunca decida
> resultados — eles chegam prontos no campo `resultado`. Jamais quebre o tom para falar
> de regras."

---

## 9. Progressão e Meta-jogo

- **XP por partida** (atuação + objetivos) → gasto em treinos entre jogos (+1 em um stat,
  máx. 20) ou em **Traços** (perks): *Cobrador oficial*, *Capitão*, *Camisa pesada*…
- **Moral** (0–100) do personagem e do time: afetada por resultados, eventos e decisões;
  dá modificador de ±2 nas rolagens. É o "clima do vestiário" do Brasfoot virado mecânica.
- **Legado (meta-progressão entre campanhas):** cada campanha encerrada gera *Pontos de
  Legado* → desbloqueiam arquétipos novos, +1 ponto de criação, skins de dado 🎲, e o
  **Hall das Lendas** (todas as crônicas finais arquivadas).
- **Modo Dinastia (pós-MVP):** o personagem envelhece e joga 2–3 Copas seguidas
  (1994→1998→2002…), com a IA costurando o arco de carreira inteiro.

---

## 10. Ideias adicionais (minha cota de palpites 😄)

1. **Card de compartilhamento:** ao fim da campanha, gerar uma imagem (Canvas) com
   apelido, seleção, nota da campanha, conquista mais rara e uma frase da crônica — feito
   para postar. É o marketing orgânico do jogo.
2. **Seed do dia (modo diário):** todos os jogadores enfrentam a mesma sequência de
   eventos/rolagens com personagens próprios — compara-se a história, não só o placar
   (estilo Wordle). Barato e altamente recorrente.
3. **Narração por época:** locutor anos 30 (formal, rádio chiando — filtro de áudio/CSS),
   anos 70 (poético), 2026 (streamer com estatísticas). Mesmo prompt, persona diferente.
4. **O Adversário também rola dados:** em momentos-chave o jogo mostra a rolagem do rival
   (ex.: o artilheiro deles contra seu goleiro). Tensão de mesa de verdade.
5. **Perguntas da imprensa pós-jogo:** a IA faz 1 pergunta provocativa; a resposta do
   jogador (entre 3 tons: humilde/provocador/evasivo) mexe na moral e planta narrativa
   futura. Custa meia chamada e rende muito drama.
6. **Modo "E se?":** recriar momentos históricos com direito a mudá-los (a final de 50,
   a semi de 2014 🇧🇷×🇩🇪…) como desafios avulsos de 1 partida.
7. **Acessibilidade nativa do texto:** por ser textual, o jogo inteiro funciona com
   leitores de tela — público raramente atendido por jogos de futebol. Vale destacar.

---

## 11. Arquitetura Técnica (reaproveitando o projeto)

```
copa/ (repo atual)
├── game/                      ← novo: o jogo (mesma filosofia: vanilla JS, sem build)
│   ├── index.html             tela do jogo (PWA própria ou rota do app atual)
│   ├── js/
│   │   ├── engine/            simulação da partida (determinística, seed)
│   │   │   ├── match.js       eventos minuto a minuto
│   │   │   ├── dice.js        d20, modificadores, críticos
│   │   │   └── ratings.js     forças (importa lógica do scripts/predict.mjs)
│   │   ├── rpg/
│   │   │   ├── character.js   ficha, classes, XP, traços
│   │   │   ├── campaign.js    estado da campanha + "diário" p/ a IA
│   │   │   └── achievements.js
│   │   ├── narrator/
│   │   │   ├── claude.js      cliente do Worker (streaming, retry, fila)
│   │   │   └── templates.js   fallback offline
│   │   └── ui/                feed da partida, dado animado, telas
│   ├── data/
│   │   ├── editions/          1930.json, 1950.json, … (seleções e formatos históricos)
│   │   └── achievements.json
│   └── css/
├── worker/
│   ├── live-proxy.js          (existente)
│   └── narrator-proxy.js      ← novo: proxy da Claude API (secret + rate-limit + schema)
└── data/teams.json …          (existente — alimenta a edição 2026)
```

- **Saves:** `localStorage`/IndexedDB (campanha, hall de lendas, conquistas). Export/import
  JSON para backup. Sem backend de contas no MVP.
- **Sem framework**, coerente com o resto do repo; o dado animado e o feed são DOM puro.
- **Capacitor** já configurado no projeto → o jogo entra no mesmo app Android.

---

## 12. Roadmap Proposto

### Fase 0 — Protótipo de mesa (1 partida, sem IA)
Engine da partida + d20 + 1 classe (Atacante) + intervenções com textos fixos.
**Critério:** uma partida completa divertida *mesmo sem IA*. Se isso não for divertido, a IA não salva.

### Fase 1 — O Mestre entra na mesa
Worker proxy + chamadas de intervenção e pós-jogo com structured outputs + streaming +
fallback de templates. **Critério:** narração com memória dentro de uma partida.

### Fase 2 — Campanha completa
Copa 1970 (16 seleções) jogável do início ao fim: pré-jogo, entre-jogos, XP/treino,
epílogo, ~20 conquistas. **Critério:** alguém termina a campanha e quer contar a história.

### Fase 3 — Níveis e classes
Todas as edições (1930→2026), todas as classes incl. Técnico, ~60 conquistas, Hall das
Lendas, card compartilhável.

### Fase 4 — Polimento e lançamento
Balanceamento de CDs e custos, sons, modo diário, BYOK opcional, publicação na Play
Store (Capacitor) e no GitHub Pages.

---

## 13. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Custo da API escalar com usuários | Worker com rate-limit + cache; modo template como teto de gasto; BYOK; rotear chamadas menores para modelo mais barato se necessário |
| Latência quebrar o ritmo da partida | Streaming + animação do dado "cobre" 1–2 s; pré-buscar o pré-jogo enquanto o jogador vê a tabela |
| IA contradizer a mecânica | Structured outputs + engine dona do resultado; IA só narra |
| Narração repetitiva em campanhas longas | Diário de campanha no prompt + flags de "já usei esse clichê" |
| Direitos (nomes de jogadores reais) | Usar só **seleções** (nomes de países) + personagem fictício do jogador; elencos reais ficam como "força do time", sem nomes — mesma abordagem do dashboard |
| Escopo explodir | Fase 0 sem IA é o gate: só avança se o núcleo divertir |

---

## 14. Questões em aberto (para decidirmos antes da Fase 0)

1. O jogo vive **dentro do app atual** (nova aba "Jogar") ou como **app/URL separado**?
2. Narração com IA já no MVP público, ou lançar Fase 0 como demo "modo clássico"?
3. Idiomas: só pt-BR no início, ou aproveitar o i18n existente (en/es/fr) desde já?
4. Nome final do jogo 🙂
