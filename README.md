# SingleHanded #3 — Tides

A 24-hour one-hand Pebble watchface for round Pebble watches with a tide display. One hand, one rotation per day.

## Concept

Time read to the nearest ~15 minutes. The face is a 24-hour clock with 12 (noon) at the top and 0/24 (midnight) at the bottom. The outer ring shows a live day/night arc — white where the sun is up, black where it isn't. Inside the tick marks, variable-height blue bars show tide levels for each hour — taller bars mean higher tides. A tapered black hand points to the current time. The interior is clean white with AM/PM labels.

## Designs

This watchface has multiple visual styles, managed on separate branches:

- **Design #1** (`main`) — full-face day/night fill, red hand, numerals inside tick marks
- **Design #2** (`one-hand-24h-design-2`) — outer ring day/night, black tapered hand, numerals on the outer edge, tick marks inside, AM/PM labels, rain overlay
- **Design #3 Tides** (`SingleHanded_#3_Tides`) — same layout as Design #2, but with per-hour tide height bars instead of rain overlay

## Features

- **Single 24h hand** — tapered, completes one full rotation per day
- **Dynamic sunrise/sunset arc** — white daytime, black nighttime, fetched from the [Open-Meteo API](https://open-meteo.com) for your actual location
- **Tide overlay** — per-hour bars with variable radial height showing wave/tide conditions. Light blue during day hours, dark blue at night. Toggleable in settings.
- **Location-aware** — JS companion gets GPS from your phone on launch, fetches today's sunrise/sunset from Open-Meteo and hourly wave height from the [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api), and sends everything to the watch. Falls back to defaults if unavailable. All values persist across restarts.
- **Settings page** — toggle 12h numeral mode and tide overlay from your phone
- **12h numeral mode** — show 1-12 twice instead of 0-23 (AM vs PM by which side of the dial the hand is on)
- **Auto-inverting labels** — hour numerals and tick marks flip between black and white to stay readable against the day/night background, with outlines at boundaries
- **Battery-friendly** — redraws once per minute

## Platforms

- **Chalk** — Pebble Time Round (180x180)
- **Gabbro** — Pebble Time Round 2 (260x260)

## Building

Requires the [Pebble SDK](https://developer.rebble.io/developer.pebble.com/sdk/index.html).

```sh
./inline-config.sh   # inlines config.html into index.js
pebble build
pebble install --emulator gabbro
# or on device:
pebble install --phone <IP>
```

## Emulator testing

The emulator has no phone connection, so sunrise/sunset and tide data won't arrive via AppMessage. To test, edit the defaults in `src/c/24h.c` and rebuild:

```c
#define DEFAULT_SUNRISE_MIN  392        // 6:32 AM
#define DEFAULT_SUNSET_MIN   1164       // 7:24 PM
#define DEFAULT_TIDE_0       0xF9632469 // hours 0-7
#define DEFAULT_TIDE_1       0x26AFFA62 // hours 8-15
#define DEFAULT_TIDE_2       0x62AFFA62 // hours 16-23
```

Tide data is packed as three int32 values, each holding 8 nibbles (4 bits per hour, values 0-15). Nibble 0 is the least significant. For example, `0xF9632469` encodes hours 0-7 as: 9, 6, 4, 2, 3, 6, 9, F.

Reset `DEFAULT_TIDE_*` to `0` before shipping.

You can also use `take-screenshots.sh` to automate screenshot capture:

```sh
./take-screenshots.sh           # defaults to 10:10
./take-screenshots.sh 14:30:00  # custom time
```

## Settings

Open the watchface settings on your phone to configure:

- **12-hour numerals** — show 1-12 twice instead of 0-23
- **Show tide overlay** — toggle tide bars on/off

To test the settings page locally, open `config.html` in a browser.

## Implementation notes

Sunrise and sunset come from the [Open-Meteo API](https://open-meteo.com). Hourly wave height comes from the [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api). Both are free with no API key required. The JS companion requests them once on launch using the phone's GPS coordinates. The 24 hourly wave heights are normalized to a 0-15 range (relative to the day's maximum) and packed into three int32 values (8 hours × 4 bits each), then sent to the watch via AppMessage.

On the watch, each hour's bar has a radial thickness proportional to its tide value (0 = hidden, 15 = 18px). Bars are drawn individually per hour, light blue during daytime and dark blue at night.

Settings are stored in persistent storage and can be updated via the config page or AppMessage: `KEY_SUNRISE`, `KEY_SUNSET`, `KEY_USE_12H`, `KEY_SHOW_TIDES`, `KEY_TIDE_0`, `KEY_TIDE_1`, `KEY_TIDE_2`.
