# Copa 2026 · Dashboard de Estatísticas ⚽

Dashboard interativo e **informativo** da Copa do Mundo FIFA 2026 (EUA · Canadá · México, 48 seleções), com **atualização diária automática**.

Feito em **HTML, CSS e JavaScript puro** — sem framework, sem build. Pode ser hospedado de graça no GitHub Pages.

## O que tem

- ⏱️ **Contagem regressiva** para o próximo jogo
- 📊 **Cartões-resumo**: nº de seleções, jogos disputados, gols, média de gols/jogo
- 🥇 **Artilharia** completa (gols, assistências, pênaltis)
- 🏆 **Classificação** por grupos
- ⚔️ **Comparador de seleções** (barras lado a lado)
- 📅 **Jogos** do dia e tabela completa com filtro por grupo

## Como funciona a atualização diária

A [football-data.org](https://www.football-data.org/) **não pode ser chamada direto do navegador** (sem CORS e a chave é secreta). Então:

```
  GitHub Action (cron diário)
        │
        ▼
  scripts/fetch-data.mjs  ──► API football-data.org
        │
        ▼
  grava /data/*.json  ──► commit automático
        │
        ▼
  site estático lê os JSON  (sem expor a chave)
```

## Configuração (uma vez)

1. **Pegue uma chave grátis:** https://www.football-data.org/client/register
2. No GitHub do repositório: **Settings → Secrets and variables → Actions → New repository secret**
   - Nome: `FOOTBALL_DATA_TOKEN`
   - Valor: a chave recebida por e-mail
3. **(Opcional) resumo por IA:** crie o secret `ANTHROPIC_API_KEY` (mesmo caminho do passo 2) para o resumo das notícias ser gerado pela Claude API. Sem ele, usa-se o resumo dos dados.
4. **Ative o GitHub Pages via Actions:** Settings → Pages → **Source: GitHub Actions**.
5. Pronto. O workflow `.github/workflows/update-data.yml` **gera os dados e publica o site no Pages a cada 2h** (e a cada push na `main`), **sem commitar dados** — o histórico do git fica limpo. Também roda manualmente em **Actions → Run workflow**.

> O workflow não escreve no repositório: os dados são gerados a cada deploy e servidos a partir do artefato publicado. Os JSON em `/data` versionados servem como exemplo/fallback para rodar localmente.

## Rodar localmente

Como o site usa `fetch`, precisa de um servidor HTTP (não abrir o arquivo direto):

```bash
# qualquer um destes:
python3 -m http.server 8000
# ou
npx serve .
```

Acesse http://localhost:8000

Para buscar dados reais localmente:

```bash
FOOTBALL_DATA_TOKEN=suachave node scripts/fetch-data.mjs
```

## Estrutura

```
index.html              página única (tabs)
css/style.css           tema escuro responsivo
js/app.js               carrega os JSON e renderiza tudo
data/*.json             dados (exemplo agora; reais após configurar o token)
scripts/fetch-data.mjs  busca os dados na API
.github/workflows/      automação diária
```

## Roadmap (ideias)

- Mapa das 16 cidades-sede com fuso e clima
- Chaveamento (bracket) do mata-mata
- Estatísticas avançadas (xG, posse) — exige API paga
- Bolão de palpites

---

Projeto educativo. Dados de football-data.org. Não afiliado à FIFA.
