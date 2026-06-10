# Mestre (Claude API) — deploy do Cloudflare Worker

Este Worker é o "Mestre" do jogo: recebe o estado da partida e devolve a
narrativa gerada pela **Claude API**. A chave fica aqui (secret), **nunca** no
navegador.

## Pré-requisitos

- Conta na [Cloudflare](https://dash.cloudflare.com/) (plano grátis serve).
- Node.js instalado (para o `wrangler`).
- Uma **chave da Claude API** em https://console.anthropic.com/ → *API Keys*.

## Passo a passo

A partir desta pasta (`worker/`):

```bash
# 1. Logar na Cloudflare
npx wrangler login

# 2. Guardar a chave da Claude como SECRET (não vai pro código)
npx wrangler secret put ANTHROPIC_API_KEY
#   cole a chave quando pedir

# 3. Publicar o Worker
npx wrangler deploy
#   ele imprime a URL, ex.: https://cronicas-mestre.SEU-SUBDOMINIO.workers.dev
```

## Ligar no jogo

Copie a URL do Worker e cole em [`../js/config.js`](../js/config.js):

```js
export const MESTRE_PROXY_URL = 'https://cronicas-mestre.SEU-SUBDOMINIO.workers.dev';
```

Faça commit/redeploy do site (Pages). Pronto — a narrativa por IA acende.
Se o Worker estiver fora do ar, o jogo volta sozinho ao modo offline.

## Travar custo e abuso (recomendado)

A maior fonte de gasto inesperado é alguém descobrir a URL e ficar chamando.
Defesas, da mais simples à mais robusta:

1. **Lock de origem** — no `wrangler.toml`, troque `ORIGENS_PERMITIDAS = "*"`
   pela origem do seu site (ex.: `"https://SEU-USER.github.io"`) e
   `npx wrangler deploy`. Chamadas de outras origens recebem 403.
2. **Teto de gasto na Anthropic** — no console, defina *spend limits* e alertas
   de orçamento. É a sua rede de segurança final.
3. **Rate limit por IP (KV)** — opcional, mas eficaz:
   ```bash
   npx wrangler kv namespace create RATE_LIMIT
   ```
   Cole o `id` retornado no `wrangler.toml` (descomente o bloco `[[kv_namespaces]]`),
   ajuste `RL_POR_MINUTO` se quiser, e `npx wrangler deploy`.
4. **Rate Limiting Rules da Cloudflare** — alternativa sem KV, no painel
   (Security → WAF → Rate limiting rules).

O jogo já limita as chamadas por partida no cliente (`MAX_IA_POR_PARTIDA`).

## Testar rápido (curl)

```bash
curl -s -X POST https://SEU-WORKER.workers.dev/cena \
  -H 'content-type: application/json' \
  -d '{"tipo":"pre","tom":"epico","personagem":{"nome":"Tião"},
       "contexto":{"meuTime":"Brasil","advTime":"Argentina","fase":"Final"}}'
# -> {"texto":"..."}
```

## Custo esperado

Com Haiku + saída estruturada + `max_tokens` baixo: **~US$ 0,05 por partida**,
**~US$ 0,40–0,70 por campanha**. Acompanhe em
https://console.anthropic.com/ → *Usage*.

## Ajustes

- Trocar o modelo: edite `MODELO_LANCE` / `MODELO_CENA` no `wrangler.toml`
  (ex.: `claude-sonnet-4-6` para narrativa mais rica nos momentos grandes —
  custa mais).
- Ver logs ao vivo: `npx wrangler tail`.
