# Crônicas da Copa ⚽🎲

> Um **RPG de mesa textual** da Copa do Mundo 2026. Crie seu jogador, escolha
> sua seleção e sua posição (classe), role o **d20** nos lances decisivos e
> construa sua própria lenda — narrada por um **Mestre** movido a IA (Claude).

Feito em **HTML, CSS e JavaScript puro** (sem framework, sem build) — PWA
instalável, mobile-first, hospedável de graça no **GitHub Pages**. O Mestre
(IA) roda atrás de um **Cloudflare Worker** que guarda a chave da Claude API.

Projeto irmão do dashboard *Copa 2026*; reaproveita os dados das 48 seleções
(Elo histórico) para um motor de partida realista.

---

## O que já funciona (MVP)

- **Criação de personagem**: nome, seleção (48 reais), classe (Goleiro, Zagueiro,
  Meia, Ponta, Centroavante), origem e tom da campanha.
- **6 atributos** (TÉC, FÍS, VIS, MEN, CAR, SOR) → modificadores de d20.
- **Partida estilo Brasfoot**: simulação textual minuto a minuto via **Elo**.
- **Lances Decisivos** (3 por jogo) com **animação de dado d20** que muda o jogo.
- **Campanha completa**: fase de grupos → mata-mata → final, com pênaltis.
- **Conquistas**, **crônica** (diário da campanha), **ficha** e **legado/epílogo**.
- **Mestre (Claude API)** narrando situações, cenas e epílogo — com **fallback
  offline** (eventos pré-escritos) quando não há Worker: o jogo nunca trava.
- **PWA**: instalável e jogável offline.

## Rodar localmente

Precisa de um servidor HTTP (o jogo usa `fetch` e módulos ES):

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

Sem configurar nada, o jogo roda 100% offline (Mestre no modo pré-escrito).

## Ligar o Mestre (Claude API) — opcional

A IA fica atrás de um Cloudflare Worker para a chave nunca ir ao navegador.
**Guia completo:** [`worker/README.md`](worker/README.md). Resumo:

1. Na pasta `worker/`: `npx wrangler login` → `npx wrangler secret put ANTHROPIC_API_KEY` → `npx wrangler deploy`.
2. Cole a URL do Worker em [`js/config.js`](js/config.js) (`MESTRE_PROXY_URL`).
3. Trave custo: `ORIGENS_PERMITIDAS` no `wrangler.toml`, *spend limit* na Anthropic e (opcional) rate-limit por KV.

### Alavancas de custo (já embutidas)

- **Haiku** (modelo mais barato) no fluxo frequente dos Lances.
- **Saída estruturada** (`output_config.format`) → JSON garantido, sem reparos.
- **`max_tokens` baixo** → trava o custo de saída.
- **Prompt caching** no bloco fixo de regras/tom.
- **Cap por partida** (`MAX_IA_POR_PARTIDA`) + **fallback offline**.

Estimativa: **~US$ 0,05 por partida** / **~US$ 0,40–0,70 por campanha** com Haiku.

## Estrutura

```
index.html              app shell (PWA)
css/style.css           tema escuro mobile-first
js/
  app.js                controlador + fluxo de partida
  config.js             URL do Worker e ajustes
  dice.js               motor de d20 (modificadores, vantagem, crítico)
  rules.js              atributos, classes, origens, tom
  engine.js             simulação de partida (Elo + Lances)
  state.js              save (localStorage) + campanha
  data.js               carrega as 48 seleções
  achievements.js       conquistas
  mestre.js             cliente da Claude API + fallback offline
  ui/screens.js         telas
  ui/dice-anim.js       animação do dado d20
data/teams-2026.json    48 seleções (Elo) — gerado por scripts/gen-teams.mjs
worker/mestre-proxy.js  Cloudflare Worker (Claude API)
scripts/                geradores de dados/ícones + smoke test
```

## Scripts

```bash
node scripts/gen-teams.mjs   # regenera data/teams-2026.json (precisa do repo copa ao lado)
node scripts/gen-icons.mjs   # regenera os ícones PNG do PWA
node scripts/smoke.mjs       # testa o motor/dado/regras (sem navegador)
```

## Publicar no GitHub Pages

Settings → Pages → **Source: GitHub Actions**. O workflow
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publica a cada
push na `main`.

---

## Roadmap (próximas fases)

- Técnico como classe (loop de escalação/tática).
- Eras históricas (1982, 1998…) como níveis de dificuldade.
- Árvore de perks/traços e leveling de atributos.
- Decisões de bastidor (imprensa, treino, vestiário).
- i18n (pt-BR, en-US, es-MX, fr-CA).

---

Projeto educativo. Dados de football-data.org + Elo histórico. Não afiliado à FIFA.
