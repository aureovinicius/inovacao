# Proxy de placar ao vivo (Cloudflare Worker)

Pequeno serviço que chama a football-data.org no servidor e devolve o JSON com CORS,
para o site estático poder atualizar o placar a cada ~45s durante os jogos.
Plano gratuito da Cloudflare cobre tranquilo (100k requisições/dia).

## Publicar — opção 1: painel web (mais fácil, sem instalar nada)

1. Crie uma conta grátis em https://dash.cloudflare.com
2. Menu **Workers & Pages → Create → Create Worker**. Dê um nome (ex.: `copa2026-live`) e **Deploy**.
3. Clique em **Edit code**, apague o conteúdo e cole o arquivo [`live-proxy.js`](./live-proxy.js). **Deploy**.
4. **Settings → Variables and Secrets → Add**:
   - Tipo **Secret**, nome `FOOTBALL_DATA_TOKEN`, valor = sua chave da football-data.org. Salve e faça **Deploy** de novo.
5. Copie a URL do Worker (algo como `https://copa2026-live.SEU-SUBDOMINIO.workers.dev`).
6. Cole essa URL em [`js/config.js`](../js/config.js) na constante `LIVE_PROXY_URL`, faça commit e push.

## Publicar — opção 2: linha de comando (wrangler)

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler deploy live-proxy.js --name copa2026-live
wrangler secret put FOOTBALL_DATA_TOKEN   # cole a chave quando pedir
```
Depois copie a URL exibida e cole em `js/config.js`.

## Testar

```bash
curl https://SUA-URL.workers.dev/matches | head -c 300
```
Deve retornar o JSON dos jogos. Se vier `{"error": "FOOTBALL_DATA_TOKEN não configurado"}`, falta o secret (passo 4).

## Como o site usa

Com `LIVE_PROXY_URL` preenchido, a página detecta sozinha quando há jogo em andamento
(ou prestes a começar) e passa a buscar `/matches` a cada ~45s, atualizando placares,
contagem, chaveamento e os cartões. Fora do horário de jogo, não faz nenhuma chamada.
Se a URL ficar vazia, o site funciona normalmente só com a atualização diária.
