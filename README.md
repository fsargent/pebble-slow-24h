# slow-24h

A 24-hour Pebble watchface for the Pebble Time Round 2 (gabbro), inspired by [Slow Watches](https://slow-watches.com).

## Concept

One hand. One rotation per day. Time read to the nearest ~15 minutes — intentionally slow.

The face is a 24-hour clock with 12 (noon) at the top and 0/24 (midnight) at the bottom. The background is split into a live day/night arc: white where the sun is up, black where it isn't. A thin red hand spans the full dial.

## Features

- **Single 24h hand** — red, edge-to-edge, completes one full rotation per day
- **Dynamic sunrise/sunset arc** — white daytime, black nighttime, fetched from the [Open-Meteo API](https://open-meteo.com) for your actual location
- **Location-aware** — JS companion gets GPS from your phone on launch, fetches today's sunrise/sunset, and sends the times to the watch. Falls back to 6 AM / 6 PM defaults if unavailable. Times are persisted across restarts.
- **12h numeral mode** — optional setting to show 1–12 twice instead of 0–23 (you know AM vs PM by which side of the dial the hand is on)
- **Auto-inverting labels** — hour numerals and tick marks flip between black and white to stay readable against the day/night background
- **Battery-friendly** — redraws once per minute

## Platform

Gabbro (Pebble Time Round 2) — circular 180×180 display.

## Building

Requires the [Pebble SDK](https://developer.rebble.io/developer.pebble.com/sdk/index.html).

```sh
pebble build
pebble install --emulator gabbro
# or on device:
pebble install --phone <IP>
```

## Implementation notes

Sunrise and sunset times come from the [Open-Meteo API](https://open-meteo.com) (free, no API key). The JS companion requests them once on launch using the phone's GPS coordinates, then sends local-time minutes-of-day to the watch via AppMessage. The watch persists the values so they survive restarts before the phone reconnects.

The 12h numeral mode and sunrise/sunset times are stored in persistent storage and can be updated via AppMessage (`KEY_USE_12H`, `KEY_SUNRISE`, `KEY_SUNSET`).
