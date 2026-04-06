#!/bin/bash
# Reads config.html and injects its URI-encoded content into index.js,
# replacing the __CONFIG_HTML__ placeholder.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
JS="$ROOT/src/pkjs/index.js"
HTML="$ROOT/config.html"

encoded=$(python3 -c "
import urllib.parse, sys
html = open('$HTML').read()
print(urllib.parse.quote(html, safe=''))
")

if grep -q '__CONFIG_HTML__' "$JS"; then
  sed -i '' "s|__CONFIG_HTML__|${encoded}|" "$JS"
  echo "config.html inlined into index.js"
else
  echo "Warning: __CONFIG_HTML__ placeholder not found in index.js"
  echo "Run 'git checkout src/pkjs/index.js' to restore the placeholder, then retry."
  exit 1
fi
