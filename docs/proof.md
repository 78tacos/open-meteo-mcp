# Local proof

Captured 2026-09-16T20:30:57.460Z against live Open-Meteo.

Target: Berlin `latitude=52.52`, `longitude=13.41`.

## Client

```json
{
  "forecast": {
    "location": {
      "latitude": 52.52,
      "longitude": 13.419998,
      "timezone": "Europe/Berlin",
      "utc_offset_seconds": 7200,
      "elevation": 38,
      "timezone_abbreviation": "GMT+2"
    },
    "current": {
      "time": "2026-09-16T22:30",
      "temperature_2m": 16.3,
      "weather_code": 3,
      "weather_label": "Overcast",
      "units": {
        "time": "iso8601",
        "interval": "seconds",
        "temperature_2m": "°C",
        "relative_humidity_2m": "%",
        "apparent_temperature": "°C",
        "precipitation": "mm",
        "weather_code": "wmo code",
        "wind_speed_10m": "km/h",
        "wind_direction_10m": "°"
      }
    },
    "daily": {
      "time": [
        "2026-09-16",
        "2026-09-17",
        "2026-09-18"
      ],
      "weather_labels": [
        "Moderate rain",
        "Slight rain showers",
        "Slight rain"
      ],
      "temperature_2m_max": [
        19.6,
        19.9,
        20.5
      ],
      "temperature_2m_min": [
        15.8,
        12.1,
        13.8
      ]
    }
  },
  "current": {
    "location": {
      "latitude": 52.52,
      "longitude": 13.419998,
      "timezone": "Europe/Berlin",
      "utc_offset_seconds": 7200,
      "elevation": 38,
      "timezone_abbreviation": "GMT+2"
    },
    "current": {
      "time": "2026-09-16T22:30",
      "temperature_2m": 16.3,
      "weather_code": 3,
      "weather_label": "Overcast",
      "units": {
        "time": "iso8601",
        "interval": "seconds",
        "temperature_2m": "°C",
        "relative_humidity_2m": "%",
        "apparent_temperature": "°C",
        "precipitation": "mm",
        "weather_code": "wmo code",
        "wind_speed_10m": "km/h",
        "wind_direction_10m": "°"
      }
    }
  },
  "geocode": {
    "id": 2950159,
    "name": "Berlin",
    "latitude": 52.52437,
    "longitude": 13.41053,
    "elevation": 74,
    "country": "Germany",
    "country_code": "DE",
    "admin1": "State of Berlin",
    "timezone": "Europe/Berlin",
    "population": 3426354,
    "feature_code": "PPLC"
  }
}
```

## MCP stdio

`initialize` then `tools/call` `get_current_weather` for the same coordinates.

```json
{
  "serverInfo": {
    "name": "open-meteo",
    "version": "1.0.0"
  },
  "protocolVersion": "2025-03-26",
  "isError": false,
  "current": {
    "location": {
      "latitude": 52.52,
      "longitude": 13.419998,
      "timezone": "Europe/Berlin",
      "utc_offset_seconds": 7200,
      "elevation": 38,
      "timezone_abbreviation": "GMT+2"
    },
    "current": {
      "time": "2026-09-16T22:30",
      "temperature_2m": 16.3,
      "weather_code": 3,
      "weather_label": "Overcast",
      "units": {
        "time": "iso8601",
        "interval": "seconds",
        "temperature_2m": "°C",
        "relative_humidity_2m": "%",
        "apparent_temperature": "°C",
        "precipitation": "mm",
        "weather_code": "wmo code",
        "wind_speed_10m": "km/h",
        "wind_direction_10m": "°"
      }
    }
  }
}
```

Result: all checks passed (client forecast, current, geocode, MCP tool call).

Re-run: `node scripts/proof.js` or `npm run proof`.

