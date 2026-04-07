#!/usr/bin/env bash
set -euo pipefail

TIME="${1:-10:10:00}"
PLATFORMS=(chalk gabbro)
DIR="screenshots"
SRCFILE="src/c/24h.c"
JSFILE="src/pkjs/index.js"

# Tide test data: a simulated tidal curve across 24 hours
# Packed as 3 int32s (8 nibbles each), values 0-15 per hour
# This gives a sinusoidal-ish pattern: low at 0h, high at 6h, low at 12h, high at 18h
TIDE_0="0xF9632469"   # hours 0-7:  9,6,4,2,3,6,9,F
TIDE_1="0x26AFFA62"   # hours 8-15: 2,6,A,F,F,A,6,2
TIDE_2="0x62AFFA62"   # hours 16-23: 2,6,A,F,F,A,6,2

mkdir -p "$DIR"

set_12h() {
  if [ "$1" = "true" ]; then
    sed -i '' 's/s_use_12h       = false/s_use_12h       = true/' "$SRCFILE"
  else
    sed -i '' 's/s_use_12h       = true/s_use_12h       = false/' "$SRCFILE"
  fi
}

set_tides() {
  sed -i '' "s/^#define DEFAULT_TIDE_0.*/#define DEFAULT_TIDE_0       $1/" "$SRCFILE"
  sed -i '' "s/^#define DEFAULT_TIDE_1.*/#define DEFAULT_TIDE_1       $2/" "$SRCFILE"
  sed -i '' "s/^#define DEFAULT_TIDE_2.*/#define DEFAULT_TIDE_2       $3/" "$SRCFILE"
}

build() {
  git checkout -- "$JSFILE" 2>/dev/null || true
  bash inline-config.sh > /dev/null
  pebble build > /dev/null 2>&1
}

# Take 12h screenshots (default, no tide data)
set_12h true
set_tides "0" "0" "0"
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

# Tide screenshots (12h mode with tide data)
set_12h true
set_tides "$TIDE_0" "$TIDE_1" "$TIDE_2"
build
echo "Built (tides mode)"

for platform in "${PLATFORMS[@]}"; do
  pebble install --emulator "$platform" > /dev/null 2>&1
  pebble emu-set-time --emulator "$platform" "$TIME" > /dev/null 2>&1
  sleep 2
  pebble screenshot --emulator "$platform" --no-open "$DIR/${platform}-tides.png" > /dev/null 2>&1
  echo "  $DIR/${platform}-tides.png"
done

# Restore defaults
set_tides "0" "0" "0"
set_12h true
git checkout -- "$JSFILE" 2>/dev/null || true

echo "Done. Defaults restored."
