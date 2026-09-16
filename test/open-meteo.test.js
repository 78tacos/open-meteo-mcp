import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildForecastUrl,
  buildGeocodeUrl,
  interpretForecastResponse,
  mapForecast,
  parseForecastQuery,
  DEFAULT_CURRENT,
  DEFAULT_DAILY,
  DEFAULT_HOURLY,
  MAX_GEOCODE_NAME,
  MAX_TIMEZONE,
  MAX_VARIABLE_LIST_CHARS,
  MAX_VARIABLES,
} from "../src/open-meteo.js";
import { weatherLabel } from "../src/weather-codes.js";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/forecast-berlin.json"), "utf8"),
);

test("weatherLabel maps documented WMO codes and unknown values", () => {
  assert.equal(weatherLabel(0), "Clear sky");
  assert.equal(weatherLabel(3), "Overcast");
  assert.equal(weatherLabel(61), "Slight rain");
  assert.equal(weatherLabel(95), "Thunderstorm");
  assert.equal(weatherLabel(42), "Unknown WMO weather code 42");
  assert.equal(weatherLabel(null), null);
});

test("parseForecastQuery fills v1 defaults and rejects a bad latitude", () => {
  const parsed = parseForecastQuery(
    { latitude: 52.52, longitude: 13.41 },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }
  assert.equal(parsed.query.timezone, "auto");
  assert.deepEqual(parsed.query.current, DEFAULT_CURRENT);
  assert.deepEqual(parsed.query.hourly, DEFAULT_HOURLY);
  assert.deepEqual(parsed.query.daily, DEFAULT_DAILY);

  const bad = parseForecastQuery(
    { latitude: 100, longitude: 13.41 },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(bad.ok, false);
  if (bad.ok) {
    return;
  }
  assert.equal(bad.status, 400);
  assert.match(bad.reason, /latitude/);

  const fromCli = parseForecastQuery(
    { latitude: "52.52", longitude: "13.41" },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(fromCli.ok, true);
  if (fromCli.ok) {
    assert.equal(fromCli.query.latitude, 52.52);
    assert.equal(fromCli.query.longitude, 13.41);
  }

  const nullLat = parseForecastQuery(
    { latitude: null, longitude: 13.41 },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(nullLat.ok, false);

  const boolDays = parseForecastQuery(
    { latitude: 52.52, longitude: 13.41, forecast_days: true },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(boolDays.ok, false);
});

test("empty variable lists omit that Open-Meteo block", () => {
  const parsed = parseForecastQuery(
    { latitude: 52.52, longitude: 13.41, hourly: [], daily: [] },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }
  const url = buildForecastUrl(parsed.query);
  assert.equal(url.origin, "https://api.open-meteo.com");
  assert.equal(url.pathname, "/v1/forecast");
  assert.equal(url.searchParams.get("latitude"), "52.52");
  assert.equal(url.searchParams.get("longitude"), "13.41");
  assert.equal(url.searchParams.get("timezone"), "auto");
  assert.equal(
    url.searchParams.get("current"),
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
  );
  assert.equal(url.searchParams.get("hourly"), null);
  assert.equal(url.searchParams.get("daily"), null);
});

test("mapForecast keeps Open-Meteo parallel arrays and attaches weather labels", () => {
  const forecast = mapForecast(fixture);
  assert.equal(forecast.location.timezone, "Europe/Berlin");
  assert.equal(forecast.location.elevation, 38);
  assert.equal(forecast.current?.data.time, "2026-09-16T18:00");
  assert.equal(forecast.current?.data.values.temperature_2m, 19);
  assert.equal(forecast.current?.data.values.weather_code, 3);
  assert.equal(forecast.current?.data.weather_label, "Overcast");
  assert.equal(forecast.current?.units.temperature_2m, "°C");
  assert.deepEqual(forecast.hourly?.data.time, ["2026-09-16T00:00", "2026-09-16T01:00"]);
  assert.deepEqual(forecast.hourly?.data.values.temperature_2m, [19.6, 19.1]);
  assert.equal(forecast.daily?.data.values.weather_code[0], 63);
  assert.equal(forecast.daily?.data.weather_labels?.[0], "Moderate rain");
});

test("interpretForecastResponse surfaces Open-Meteo error JSON", () => {
  const result = interpretForecastResponse(400, {
    error: true,
    reason: "Latitude must be in range of -90 to 90°. Given: 200.0.",
  });
  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }
  assert.equal(result.status, 400);
  assert.equal(result.reason, "Latitude must be in range of -90 to 90°. Given: 200.0.");
});

test("buildGeocodeUrl requires a name", () => {
  const missing = buildGeocodeUrl({});
  assert.equal(missing instanceof URL, false);
  const url = buildGeocodeUrl({ name: "Berlin", count: 3 });
  assert.equal(url instanceof URL, true);
  if (!(url instanceof URL)) {
    return;
  }
  assert.equal(url.origin, "https://geocoding-api.open-meteo.com");
  assert.equal(url.pathname, "/v1/search");
  assert.equal(url.searchParams.get("name"), "Berlin");
  assert.equal(url.searchParams.get("count"), "3");
  assert.equal(url.searchParams.get("format"), "json");
});

test("comma-separated variable lists parse and oversize inputs fail locally", () => {
  const parsed = parseForecastQuery(
    { latitude: 52.52, longitude: 13.41, hourly: "temperature_2m,precipitation" },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }
  assert.deepEqual(parsed.query.hourly, ["temperature_2m", "precipitation"]);

  const tooMany = parseForecastQuery(
    {
      latitude: 52.52,
      longitude: 13.41,
      hourly: Array.from({ length: MAX_VARIABLES + 1 }, (_, i) => `v${i}`),
    },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(tooMany.ok, false);
  if (tooMany.ok) {
    return;
  }
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.reason, /at most 50/);

  const commaName = parseForecastQuery(
    { latitude: 52.52, longitude: 13.41, hourly: ["foo,bar"] },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(commaName.ok, false);
  if (commaName.ok) {
    return;
  }
  assert.match(commaName.reason, /commas or URL delimiters/);

  const tooLong = parseForecastQuery(
    { latitude: 52.52, longitude: 13.41, hourly: "x".repeat(MAX_VARIABLE_LIST_CHARS + 1) },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(tooLong.ok, false);
  if (tooLong.ok) {
    return;
  }
  assert.match(tooLong.reason, /characters/);

  const longZone = parseForecastQuery(
    { latitude: 52.52, longitude: 13.41, timezone: "x".repeat(MAX_TIMEZONE + 1) },
    { current: DEFAULT_CURRENT, hourly: DEFAULT_HOURLY, daily: DEFAULT_DAILY },
  );
  assert.equal(longZone.ok, false);
  if (longZone.ok) {
    return;
  }
  assert.match(longZone.reason, /timezone/);
});

test("oversized geocode name fails locally", () => {
  const result = buildGeocodeUrl({ name: "x".repeat(MAX_GEOCODE_NAME + 1) });
  assert.equal(result instanceof URL, false);
  if (result instanceof URL) {
    return;
  }
  assert.equal(result.status, 400);
  assert.match(result.reason, /name must be at most/);
});
