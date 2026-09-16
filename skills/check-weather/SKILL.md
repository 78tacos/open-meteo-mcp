---
name: check-weather
description: Check current weather for a named place or lat/lon using Open-Meteo. Use when the user asks what it is like outside, whether to bring a jacket, or current conditions in a city.
---

# Check weather

Use this skill when the user wants current conditions, not a multi-day comparison.

## Steps

1. If the user gave a place name, call `geocode_location` with that name. Pick the match that fits the country or region they mentioned. If several countries match and they did not say which, ask once.
2. If they already gave coordinates, skip geocoding.
3. Call `get_current_weather` with `latitude` and `longitude`.
4. Answer from the tool payload. Use `weather_label` next to `weather_code`. Quote temperature and wind with the unit strings from `current.units`. Do not invent a station or a value the payload omitted.

Do not guess lat/lon. Do not call archive, air-quality, or marine APIs. This plugin is forecast v1 only.
