# slow-24h

A 24-hour Pebble watchface for round Pebble watches, inspired by [Slow Watches](https://slow-watches.com).

## Concept

One hand. One rotation per day. Time read to the nearest ~15 minutes — intentionally slow.

The face is a 24-hour clock with 12 (noon) at the top and 0/24 (midnight) at the bottom. The background is split into a live day/night arc: white where the sun is up, black where it isn't. Hours with rain are overlaid in blue. A thin red hand spans the full dial.

## Features

- **Single 24h hand** — red, edge-to-edge, completes one full rotation per day
- **Dynamic sunrise/sunset arc** — white daytime, black nighttime, fetched from the [Open-Meteo API](https://open-meteo.com) for your actual location
- **Rain overlay** — hours with >50% precipitation probability are shown as light blue (day) or dark blue (night) arcs on the dial. Enabled automatically when weather data is available.
- **Location-aware** — JS companion gets GPS from your phone on launch, fetches today's sunrise/sunset and hourly precipitation from Open-Meteo, and sends everything to the watch. Falls back to defaults if unavailable. All values are persisted across restarts.
- **12h numeral mode** — optional setting to show 1-12 twice instead of 0-23 (you know AM vs PM by which side of the dial the hand is on)
- **Auto-inverting labels** — hour numerals and tick marks flip between black and white to stay readable against the day/night background, with outlines for visibility at boundaries
- **Battery-friendly** — redraws once per minute

## Platforms

- **Chalk** — Pebble Time Round (180x180)
- **Gabbro** — Pebble Time Round 2 (260x260)

## Building

Requires the [Pebble SDK](https://developer.rebble.io/developer.pebble.com/sdk/index.html).

```sh
pebble build
pebble install --emulator gabbro
# or on device:
pebble install --phone <IP>
```

## Emulator testing

The emulator has no phone connection, so sunrise/sunset and rain data won't arrive via AppMessage. To test, edit the defaults in `src/c/24h.c` and rebuild:

```c
#define DEFAULT_SUNRISE_MIN  392      // 6:32 AM
#define DEFAULT_SUNSET_MIN   1164     // 7:24 PM
#define DEFAULT_RAIN_HOURS   0x007F00 // rain hours 8-14
```

The rain bitmask is a 24-bit integer where bit N corresponds to hour N. Some useful test values:

| Value | Hours | Description |
|-------|-------|-------------|
| `0x007F00` | 8-14 | Morning through early afternoon |
| `0x03FC00` | 10-17 | Midday into evening |
| `0x00F00F` | 0-3, 12-15 | Two blocks (night + day) |
| `0xFFFFFF` | 0-23 | Rain all day |

Reset all defaults to `0` before shipping.

You can also use `take-screenshots.sh` to automate screenshot capture:

```sh
./take-screenshots.sh           # defaults to 10:10
./take-screenshots.sh 14:30:00  # custom time
```

## Implementation notes

Sunrise, sunset, and hourly precipitation probability come from the [Open-Meteo API](https://open-meteo.com) (free, no API key). The JS companion requests them once on launch using the phone's GPS coordinates, collapses the 24 hourly precipitation probabilities into a single bitmask (bit set if >50%), and sends everything to the watch via AppMessage.

Settings are stored in persistent storage and can be updated via AppMessage: `KEY_SUNRISE`, `KEY_SUNSET`, `KEY_USE_12H`, `KEY_RAIN_HOURS`.
