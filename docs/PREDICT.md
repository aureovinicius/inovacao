# Módulo preditivo — como funciona (`scripts/predict.mjs`)

Calcula, por seleção, as probabilidades de **título, final, semi, quartas, oitavas, avançar do grupo e vencer o grupo**. Roda no cron e grava `data/predictions.json`.

## Peça A — força das seleções (Elo)

Cada seleção tem uma nota **Elo**, calculada a partir do **histórico de jogos internacionais** (base pública em CSV: Eliminatórias, Copas, amistosos, etc.). Para cada jogo do histórico:

```
Esperado(A) = 1 / (1 + 10^((EloB − EloA − mando) / 400))
EloA += K · G · (resultado − Esperado(A))
```
- **mando**: bônus para quem joga em casa (só país-sede na Copa).
- **K**: peso por importância do torneio (Copa > Eliminatórias > amistoso).
- **G**: multiplicador por saldo de gols (goleada move mais o rating).

Resultado: um número por seleção (ex.: ~2200 = muito forte, ~1600 = fraca). Sem o CSV, cai num Elo-semente de fallback.

## Peça B — simulação de Monte Carlo (20.000 vezes)

Cada confronto de grupo vira um placar via **Poisson**, com os gols esperados derivados da diferença de Elo:
```
saldo_esperado = (EloA + mando − EloB) / 170      (≈170 de Elo por gol)
λA = (2,6 + saldo)/2 ;  λB = (2,6 − saldo)/2       (2,6 = média de gols/jogo)
gols ~ Poisson(λ)
```
Em cada uma das 20 mil simulações:
1. Joga os 6 confrontos de cada grupo (usa resultados reais já ocorridos quando existem).
2. Ordena cada grupo pelos **critérios da FIFA** (pontos → saldo → gols → confronto direto).
3. Seleciona os **8 melhores terceiros**.
4. Joga o mata-mata (no empate, decide pelo Elo) e anota até onde cada seleção chegou.

No fim: `P(título) = vezes que foi campeã / 20.000`, e assim por diante.

## O que é exato e o que é aproximação (v1)

| Parte | Status |
|---|---|
| Elo do histórico | calculado por nós (não importado) |
| Fase de grupos + desempates FIFA | **exato** |
| Seleção dos 8 melhores terceiros | exato (pontos, saldo, gols) |
| **Chaveamento do mata-mata** | **tabela oficial FIFA 2026** (jogos 73–104); os 8 terceiros são alocados aos slots por *matching* respeitando os grupos permitidos de cada jogo |

Validação interna a cada execução: soma de "campeão" = 100%, soma de "avança" = 3200% (32 vagas), soma de "final" = 200% (2 finalistas).

## Como validar (próximos passos)
- **Calibração**: dos jogos previstos a ~60%, ~60% se confirmaram?
- **Brier score / log-loss** contra um palpite-base.
- **Backtesting** em Copas anteriores.

## Parâmetros ajustáveis (topo do `predict.mjs`)
`HOME_ADV`, `ELO_PER_GOAL`, `AVG_TOTAL_GOALS`, pesos de torneio e `PREDICT_SIMS` (nº de simulações).
