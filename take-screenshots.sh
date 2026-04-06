#!/usr/bin/env bash
set -euo pipefail

TIME="${1:-10:10:00}"
PLATFORMS=(chalk gabbro)
MODES=(24h 12h)
DIR="screenshots"

mkdir -p "$DIR"

for mode in "${MODES[@]}"; do
  if [ "$mode" = "12h" ]; then
    sed -i '' 's/s_use_12h       = false/s_use_12h       = true/' src/c/24h.c
  else
    sed -i '' 's/s_use_12h       = true/s_use_12h       = false/' src/c/24h.c
  fi

  pebble build > /dev/null 2>&1
  echo "Built ($mode mode)"

  for platform in "${PLATFORMS[@]}"; do
    pebble install --emulator "$platform" > /dev/null 2>&1
    pebble emu-set-time --emulator "$platform" "$TIME" > /dev/null 2>&1
    sleep 2
    pebble screenshot --emulator "$platform" --no-open "$DIR/${platform}-${mode}.png" > /dev/null 2>&1
    echo "  $DIR/${platform}-${mode}.png"
  done
done

# restore default (24h mode)
sed -i '' 's/s_use_12h       = true/s_use_12h       = false/' src/c/24h.c
pebble build > /dev/null 2>&1

echo "Done. Defaults restored."
