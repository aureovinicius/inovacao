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
3. **Ative o GitHub Pages:** Settings → Pages → Branch `main` (ou a branch do projeto), pasta `/root`.
4. Pronto. O workflow `.github/workflows/update-data.yml` roda todo dia às 09:00 UTC e também pode ser disparado manualmente em **Actions → Atualizar dados da Copa 2026 → Run workflow**.

> Enquanto o token não estiver configurado, o site usa os **dados de exemplo** já versionados em `/data`, então tudo funciona de cara.

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
