---
name: compare-forecast
description: Compare the next N days of weather for a place using Open-Meteo daily forecast. Use when the user asks about the weekend, a trip, or which day is driest or warmest.
---

# Compare forecast

Use this skill when the user wants an outlook across days, not only now.

## Steps

1. Resolve the place with `geocode_location` unless they already gave coordinates.
2. Call `get_forecast` with `latitude`, `longitude`, and `forecast_days` set to the span they asked for (1 to 16). Leave `daily` unset so v1 defaults apply (`weather_code`, `temperature_2m_max`, `temperature_2m_min`, `precipitation_sum`, `precipitation_probability_max`).
3. If they also asked about the next few hours, leave `hourly` unset. If they only want daily, pass `hourly: []` so the hourly block is omitted.
4. Present one row per date from `daily.data.time`. Pair `weather_labels[i]` with highs, lows, and precipitation using `daily.units`.

Stay inside the returned series. Do not interpolate missing days. Timezone is `auto` unless the user named one.
