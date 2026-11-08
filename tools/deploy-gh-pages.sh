#!/bin/sh
# Protel Hilfe – Veröffentlichung auf GitHub Pages (kostenlos, öffentliches Repository)
#
# Überträgt den Inhalt von protel-hilfe/ (Stand des aktuellen Commits) in den Branch "gh-pages".
# GitHub Pages muss einmalig eingestellt sein: Settings → Pages → "Deploy from a branch" → gh-pages / (root).
#
# Der Branch gh-pages enthält nur die fertige Website und wird bei jeder Veröffentlichung ersetzt –
# bitte nicht von Hand bearbeiten. Er kann jederzeit als ZIP heruntergeladen und bei einem anderen
# Anbieter für statische Websites hochgeladen werden.
set -e
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain -- protel-hilfe tools)" ]; then
  echo "Bitte zuerst alle Änderungen in protel-hilfe/ committen." >&2
  exit 1
fi
# Veröffentlichungssperre: ganzes Repository prüfen (keine internen Inhalte, nur freigegebene Bilder)
node tools/pruefe-veroeffentlichung.js --repo
node tools/build-pwa.js --check
printf 'Wirklich veröffentlichen? Die Website ist öffentlich. Nur mit Freigabe! [ja/nein] '
read -r antwort
if [ "$antwort" != "ja" ]; then
  echo "Abgebrochen – nichts veröffentlicht." >&2
  exit 1
fi

git branch -D gh-pages-deploy 2>/dev/null || true
git subtree split --prefix protel-hilfe -b gh-pages-deploy
# Normaler Push (kein Überschreiben): Die Historie von gh-pages wächst mit jeder Veröffentlichung weiter.
# Schlägt er fehl, wurde gh-pages von anderer Stelle verändert – dann bitte zuerst klären, nicht erzwingen.
git push origin gh-pages-deploy:gh-pages
git branch -D gh-pages-deploy
echo "Veröffentlicht. GitHub Pages aktualisiert die Website in der Regel innerhalb weniger Minuten."
