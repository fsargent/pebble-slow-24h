#!/usr/bin/env bash
set -euo pipefail

TIME="${1:-10:10:00}"
PLATFORMS=(chalk gabbro)
DIR="screenshots"
SRCFILE="src/c/24h.c"
JSFILE="src/pkjs/index.js"

# rain bitmask: hours 2-5 (night) + 10-15 (day)
RAIN_BITMASK="0xFC3C"

mkdir -p "$DIR"

set_12h() {
  if [ "$1" = "true" ]; then
    sed -i '' 's/s_use_12h       = false/s_use_12h       = true/' "$SRCFILE"
  else
    sed -i '' 's/s_use_12h       = true/s_use_12h       = false/' "$SRCFILE"
  fi
}

set_rain() {
  sed -i '' "s/^#define DEFAULT_RAIN_HOURS.*/#define DEFAULT_RAIN_HOURS   $1/" "$SRCFILE"
}

build() {
  git checkout -- "$JSFILE" 2>/dev/null || true
  bash inline-config.sh > /dev/null
  pebble build > /dev/null 2>&1
}

# Design #2 defaults: 12h numerals
# Take 12h screenshots (default)
set_12h true
build
echo "Built (12h mode)"

for platform in "${PLATFORMS[@]}"; do
  pebble install --emulator "$platform" > /dev/null 2>&1
  pebble emu-set-time --emulator "$platform" "$TIME" > /dev/null 2>&1
  sleep 2
  pebble screenshot --emulator "$platform" --no-open "$DIR/${platform}-12h.png" > /dev/null 2>&1
  echo "  $DIR/${platform}-12h.png"
done

# Take 24h screenshots
set_12h false
build
echo "Built (24h mode)"

for platform in "${PLATFORMS[@]}"; do
  pebble install --emulator "$platform" > /dev/null 2>&1
  pebble emu-set-time --emulator "$platform" "$TIME" > /dev/null 2>&1
  sleep 2
  pebble screenshot --emulator "$platform" --no-open "$DIR/${platform}-24h.png" > /dev/null 2>&1
  echo "  $DIR/${platform}-24h.png"
done

# Rain screenshots (12h mode with rain bitmask)
set_12h true
set_rain "$RAIN_BITMASK"
build
echo "Built (rain mode)"

for platform in "${PLATFORMS[@]}"; do
  pebble install --emulator "$platform" > /dev/null 2>&1
  pebble emu-set-time --emulator "$platform" "$TIME" > /dev/null 2>&1
  sleep 2
  pebble screenshot --emulator "$platform" --no-open "$DIR/${platform}-rain.png" > /dev/null 2>&1
  echo "  $DIR/${platform}-rain.png"
done

# Restore defaults
set_rain "0"
set_12h true
git checkout -- "$JSFILE" 2>/dev/null || true

echo "Done. Defaults restored."
