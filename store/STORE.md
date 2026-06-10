# Submissão na Google Play — Painel da Copa · 2026

Guia das peças necessárias para publicar o app (TWA) na Play Store. Tudo aqui é
texto/config — nenhum dado pessoal é coletado pelo app, o que simplifica muito o
formulário de "Segurança dos dados".

---

## 0. Identidade do app (mantenha os 3 em sincronia)

| Item | Valor |
|---|---|
| **Package name / applicationId** | `com.copa2026.stats` |
| **URL do PWA (TWA)** | `https://aureovinicius.com.br/copa/` |
| **Manifest** | `https://aureovinicius.com.br/copa/manifest.json` |
| **Host verificado (Digital Asset Links)** | `aureovinicius.com.br` |

> O `package_name` precisa ser **idêntico** em três lugares: na Play Console, no
> `assetlinks.json` e no `applicationId` que o PWABuilder/Bubblewrap gerar. Se
> quiser trocar (ex.: `br.com.aureovinicius.copa`), troque nos três.

---

## 1. assetlinks.json (Digital Asset Links) — onde vai e o que preencher

⚠️ **Importante:** o arquivo NÃO vai no repositório do app (`/copa`). O Android
valida os Digital Asset Links sempre na **raiz do host**, ignorando o caminho:

```
https://aureovinicius.com.br/.well-known/assetlinks.json
```

Como o domínio é servido pelo **repositório do hub** (`aureovinicius.github.io`),
o arquivo precisa ir LÁ:

1. No repo `aureovinicius.github.io`, crie a pasta `.well-known/` e dentro dela o
   arquivo `assetlinks.json` (use o template em `store/assetlinks.json` deste repo).
2. Garanta que o repo do hub tenha um arquivo **`.nojekyll`** na raiz — sem ele o
   GitHub Pages ignora pastas que começam com `.` e o `/.well-known/` não é servido.
3. Faça commit e aguarde o deploy. Teste abrindo a URL acima no navegador: deve
   baixar/exibir o JSON.

### Preenchendo os fingerprints SHA-256

O array `sha256_cert_fingerprints` precisa do(s) certificado(s) de assinatura:

- **Chave de assinatura do app (Play App Signing)** — recomendado e padrão.
  Depois de criar o app na Play Console e enviar o primeiro `.aab`:
  `Play Console → Testes e versão → Configuração → Assinatura de app →`
  copie o **"Certificado da chave de assinatura do app" → SHA-256**.
- **Chave de upload** — o PWABuilder/Bubblewrap gera uma chave própria e já te
  entrega um `assetlinks.json` com o SHA-256 dela.

👉 Coloque **os dois** fingerprints no array (é o cenário mais seguro: cobre tanto
a verificação durante os testes quanto a versão final reassinada pelo Google).
Formato esperado: `AB:CD:EF:...` (maiúsculas, separados por `:`).

Validação oficial:
`https://developers.google.com/digital-asset-links/tools/generator`

---

## 2. Listagem da loja (textos)

### Nome do app (máx. 30 caracteres)
```
Painel da Copa · 2026
```

### Categoria
- **Categoria:** Esportes
- **Tags:** futebol, copa do mundo, estatísticas, placar ao vivo

### Descrição curta (máx. 80 caracteres)

**pt-BR**
```
Estatísticas, placar ao vivo, chaveamento e probabilidades da Copa 2026.
```
**en-US**
```
Live scores, stats, bracket and win probabilities for the 2026 World Cup.
```
**es-MX**
```
Marcadores en vivo, estadísticas, llaves y probabilidades del Mundial 2026.
```
**fr-CA**
```
Scores en direct, stats, tableau et probabilités de la Coupe 2026.
```

### Descrição completa (máx. 4000 caracteres)

**pt-BR**
```
Acompanhe a Copa do Mundo FIFA 2026 num painel rápido, leve e sem anúncios.

⚽ O que você encontra:
• Placar ao vivo dos jogos
• Classificação dos 12 grupos, atualizada automaticamente
• Artilharia e estatísticas dos jogadores
• Chaveamento da fase final (32 classificados) que se preenche conforme os jogos avançam
• Comparador de seleções
• Agenda de jogos com filtro por fase
• Probabilidades de título, classificação e liderança de grupo, calculadas por um modelo estatístico próprio (rating Elo + simulação de Monte Carlo) e recalibrado a cada rodada
• Resumo diário das notícias

🌎 Disponível em português, inglês, espanhol e francês — abre automaticamente no idioma do seu aparelho.

📲 Funciona offline (dados recentes ficam em cache) e atualiza sozinho ao longo do dia.

Projeto educativo. Não afiliado à FIFA. Dados fornecidos por football-data.org.
```

**en-US**
```
Follow the FIFA World Cup 2026 in a fast, lightweight, ad-free dashboard.

⚽ What's inside:
• Live match scores
• Standings for all 12 groups, updated automatically
• Top scorers and player stats
• Knockout bracket (32 qualifiers) that fills in as matches are played
• Head-to-head team comparison
• Match schedule with stage filter
• Title, advancement and group-winner probabilities from an in-house statistical model (Elo rating + Monte Carlo simulation), recalibrated every round
• Daily news summary

🌎 Available in Portuguese, English, Spanish and French — opens automatically in your device's language.

📲 Works offline (recent data is cached) and refreshes itself throughout the day.

Educational project. Not affiliated with FIFA. Data provided by football-data.org.
```

**es-MX**
```
Sigue la Copa Mundial FIFA 2026 en un panel rápido, ligero y sin anuncios.

⚽ Qué incluye:
• Marcadores en vivo
• Posiciones de los 12 grupos, actualizadas automáticamente
• Goleadores y estadísticas de jugadores
• Llave de eliminatorias (32 clasificados) que se llena conforme avanzan los partidos
• Comparador de selecciones
• Calendario de partidos con filtro por fase
• Probabilidades de título, clasificación y liderato de grupo, con un modelo estadístico propio (rating Elo + simulación Monte Carlo), recalibrado en cada ronda
• Resumen diario de noticias

🌎 Disponible en portugués, inglés, español y francés — se abre automáticamente en el idioma de tu dispositivo.

📲 Funciona sin conexión (los datos recientes quedan en caché) y se actualiza solo durante el día.

Proyecto educativo. No afiliado a la FIFA. Datos de football-data.org.
```

**fr-CA**
```
Suivez la Coupe du monde FIFA 2026 dans un tableau de bord rapide, léger et sans pub.

⚽ Au programme :
• Scores en direct
• Classements des 12 groupes, mis à jour automatiquement
• Meilleurs buteurs et statistiques des joueurs
• Tableau de la phase finale (32 qualifiés) qui se remplit au fil des matchs
• Comparateur d'équipes
• Calendrier des matchs avec filtre par phase
• Probabilités de titre, de qualification et de tête de groupe, via un modèle statistique maison (cote Elo + simulation Monte-Carlo), recalibré à chaque tour
• Résumé quotidien de l'actualité

🌎 Offert en portugais, anglais, espagnol et français — s'ouvre automatiquement dans la langue de votre appareil.

📲 Fonctionne hors ligne (les données récentes sont mises en cache) et se met à jour seul durant la journée.

Projet éducatif. Non affilié à la FIFA. Données fournies par football-data.org.
```

---

## 3. Recursos gráficos exigidos pela Play

| Recurso | Tamanho | Observação |
|---|---|---|
| Ícone do app | 512 × 512 PNG | use `icons/icon-512.png` (já gerado) |
| Gráfico de destaque (feature graphic) | 1024 × 500 PNG/JPG | obrigatório |
| Capturas de tela (telefone) | 2 a 8, mín. 320 px | tire das abas Visão geral / Probabilidades / Chaveamento |
| Capturas (tablet 7" e 10") | opcional, recomendado | |

> O ícone enviado ao PWABuilder vem do `manifest.json`, mas a Play exige o
> upload separado do 512×512 na listagem.

---

## 4. Privacidade (URL + formulário "Segurança dos dados")

- **URL da política de privacidade:** `https://aureovinicius.com.br/copa/privacy.html`
  (página já criada neste repo, em 4 idiomas).

- **Formulário "Segurança dos dados" (Data safety):**
  - O app coleta ou compartilha dados do usuário? → **Não**
  - Há coleta de dados? → **Nenhum dado coletado**
  - Há compartilhamento? → **Nenhum**
  - Os dados são criptografados em trânsito? → **Sim** (HTTPS)
  - O usuário pode pedir exclusão de dados? → não se aplica (nada é coletado)
  - Justificativa: o app não tem login, não usa analytics nem SDK de anúncios.
    A preferência de idioma e o cache offline ficam só no aparelho; o IP usado
    para entregar requisições não é armazenado.

---

## 5. Classificação de conteúdo (Content rating)

- Responda o questionário como **app de informação/esportes**, sem violência,
  sem conteúdo adulto, sem interação social, sem compras.
- Resultado esperado: **Livre para todos** (everyone).

---

## 6. Fluxo resumido de publicação (TWA)

1. **PWABuilder** (https://www.pwabuilder.com): cole `https://aureovinicius.com.br/copa/`,
   gere o pacote **Android** (TWA). Anote o `applicationId` e baixe o `.aab`,
   a chave de assinatura e o `assetlinks.json` que ele fornece.
2. Coloque o `assetlinks.json` (com os SHA-256 corretos) no **hub** em
   `.well-known/assetlinks.json` (passo 1 deste guia) e publique.
3. Na **Play Console**: crie o app, preencha listagem (seção 2), gráficos (3),
   privacidade (4) e classificação (5).
4. Envie o `.aab` numa faixa de **teste interno** primeiro. Habilite **Play App
   Signing**, pegue o **SHA-256 da chave de assinatura do app** e adicione ao
   `assetlinks.json` do hub (junto com o da chave de upload).
5. Teste: instale pelo teste interno e confirme que o app abre **sem a barra de
   URL do navegador** (isso prova que o Digital Asset Links validou). Se a barra
   aparecer, o `assetlinks.json` está errado ou inacessível.
6. Promova para produção e publique.
```
