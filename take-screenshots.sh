#!/usr/bin/env bash
set -euo pipefail

TIME="${1:-10:10:00}"
PLATFORMS=(chalk gabbro)
MODES=(24h 12h)
DIR="screenshots"
SRCFILE="src/c/24h.c"

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

for mode in "${MODES[@]}"; do
  [ "$mode" = "12h" ] && set_12h true || set_12h false

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

# rain screenshots (24h mode with rain bitmask)
set_12h false
set_rain "$RAIN_BITMASK"
mode="24h"

pebble build > /dev/null 2>&1
echo "Built (rain mode)"

for platform in "${PLATFORMS[@]}"; do
  pebble install --emulator "$platform" > /dev/null 2>&1
  pebble emu-set-time --emulator "$platform" "$TIME" > /dev/null 2>&1
  sleep 2
  pebble screenshot --emulator "$platform" --no-open "$DIR/${platform}-${mode}-rain.png" > /dev/null 2>&1
  echo "  $DIR/${platform}-${mode}-rain.png"
done

# restore defaults
set_rain "0"
pebble build > /dev/null 2>&1

echo "Done. Defaults restored."
