# App no celular — PWA e Capacitor

O site **já é uma PWA**: instalável, em tela cheia e com funcionamento offline. Para presença nas lojas (Play Store / App Store), use o Capacitor — sem reescrever nada.

## PWA (já pronta, sem custo)

Arquivos: `manifest.json`, `sw.js` (service worker) e `icons/`. O `index.html` referencia o manifest e o `app.js` registra o service worker.

**Como instalar no celular:**
- **Android (Chrome):** abrir o site → menu → "Instalar app" / "Adicionar à tela inicial".
- **iOS (Safari):** Compartilhar → "Adicionar à Tela de Início".

**Estratégia de cache (no `sw.js`):** app shell rápido/offline, mas `data/*.json` é sempre buscado da rede primeiro — placar e probabilidades não congelam. Ao publicar mudanças de **código**, incremente `VERSION` no `sw.js` para renovar o cache.

**Trocar os ícones:** rode `npm run icons` (gera placeholders) ou substitua os PNGs em `icons/` pela arte final (mantendo os tamanhos 192/512 e o `maskable-512`).

## Capacitor (apps nas lojas)

Empacota a mesma PWA num app nativo. Requer Node + Android Studio (e um **Mac com Xcode** para iOS). Config já incluída em `capacitor.config.json` (`webDir: "_site"`).

```bash
# 1. Instalar
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# 2. Montar a pasta web (mesma do deploy)
npm run build            # gera _site/ com index, css, js, data, manifest, sw, icons

# 3. Adicionar as plataformas
npx cap add android
npx cap add ios          # só em macOS

# 4. Sempre que mudar o site
npm run build && npx cap sync

# 5. Abrir nas IDEs nativas para gerar/publicar
npx cap open android     # Android Studio → gera .aab para a Play Store
npx cap open ios         # Xcode (macOS) → gera .ipa para a App Store
```

**Conteúdo embutido + dados remotos (recomendado):** o app embarca a casca (HTML/CSS/JS) e continua buscando os `data/*.json` do GitHub Pages — então placares/probabilidades atualizam **sem republicar na loja**; só mudanças de código pedem nova versão.

**Notas:**
- Ajuste `appId` em `capacitor.config.json` para o seu domínio reverso (ex.: `com.seudominio.copa2026`).
- **Play Store:** taxa única de US$25; wrappers são aceitos.
- **App Store:** US$99/ano; a Apple pode exigir valor nativo (ex.: **push**) além de "site embrulhado".
- **Push notifications:** plugin `@capacitor/push-notifications` (FCM no Android, APNs no iOS) — requer um backend para disparar.
- **Atualização OTA** de código sem passar pela loja: serviços como Capgo (open source) ou Appflow.
