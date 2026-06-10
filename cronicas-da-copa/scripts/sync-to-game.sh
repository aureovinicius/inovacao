#!/usr/bin/env bash
# Sincroniza "Crônicas da Copa" da branch de desenvolvimento (no repo copa)
# para o seu clone local do repositório "game", já com commit e push.
#
# Uso (a partir do seu clone local do game):
#   ./scripts/sync-to-game.sh            # usa o diretório atual como destino
#   ./scripts/sync-to-game.sh /caminho/para/game
#
# Requisitos: git e rsync.
set -euo pipefail

DEST="${1:-.}"
ORIGEM_REPO="${COPA_REPO:-https://github.com/aureovinicius/copa}"
BRANCH="${COPA_BRANCH:-claude/world-cup-rpg-game-design-rwc33w}"
SUBPASTA="cronicas-da-copa"

if [ ! -d "$DEST/.git" ]; then
  echo "ERRO: '$DEST' não parece um repositório git (esperava o clone do 'game')." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "» Baixando $BRANCH de $ORIGEM_REPO ..."
git clone --depth 1 --branch "$BRANCH" "$ORIGEM_REPO" "$TMP" >/dev/null 2>&1

if [ ! -d "$TMP/$SUBPASTA" ]; then
  echo "ERRO: pasta '$SUBPASTA' não encontrada na branch." >&2
  exit 1
fi

echo "» Espelhando $SUBPASTA/ -> $DEST ..."
# --delete remove no destino o que foi apagado na origem.
# Os --exclude protegem o .git e artefatos locais do destino contra remoção.
rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.wrangler/' \
  --exclude '_site/' \
  "$TMP/$SUBPASTA/" "$DEST/"

cd "$DEST"
git add -A
if git diff --cached --quiet; then
  echo "» Nada novo para commitar. Já está sincronizado."
  exit 0
fi
git commit -m "sync: Crônicas da Copa (de copa@$BRANCH)"
git push
echo "✅ Repositório 'game' atualizado e publicado."
