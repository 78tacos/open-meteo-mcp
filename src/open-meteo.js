import { weatherLabel } from "./weather-codes.js";

export const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
export const GEOCODE_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
export const USER_AGENT =
  "open-meteo-mcp/1.0.0 (https://github.com/78tacos/open-meteo-mcp)";

export const DEFAULT_CURRENT = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
];

export const DEFAULT_HOURLY = [
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
];

export const DEFAULT_DAILY = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
];

const CURRENT_META = new Set(["time", "interval"]);
const SERIES_META = new Set(["time"]);
const TEMPERATURE_UNITS = new Set(["celsius", "fahrenheit"]);
const WIND_SPEED_UNITS = new Set(["kmh", "ms", "mph", "kn"]);
const PRECIPITATION_UNITS = new Set(["mm", "inch"]);

export const MAX_VARIABLES = 50;
export const MAX_VARIABLE_NAME = 64;
export const MAX_TIMEZONE = 64;
export const MAX_GEOCODE_NAME = 200;
export const MAX_LANGUAGE = 32;
export const MAX_VARIABLE_LIST_CHARS = MAX_VARIABLES * (MAX_VARIABLE_NAME + 1);

/**
 * @typedef {object} ForecastQuery
 * @property {number} latitude
 * @property {number} longitude
 * @property {string[] | null} current
 * @property {string[] | null} hourly
 * @property {string[] | null} daily
 * @property {string} timezone
 * @property {number} [forecast_days]
 * @property {string} [temperature_unit]
 * @property {string} [wind_speed_unit]
 * @property {string} [precipitation_unit]
 *
 * @typedef {object} Location
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} [elevation]
 * @property {string} timezone
 * @property {string} [timezone_abbreviation]
 * @property {number} utc_offset_seconds
 *
 * @typedef {object} CurrentObservation
 * @property {string} time
 * @property {number} [interval]
 * @property {Record<string, number | string | null>} values
 * @property {string | null} [weather_label]
 *
 * @typedef {object} TimeSeries
 * @property {string[]} time
 * @property {Record<string, Array<number | string | null>>} values
 * @property {Array<string | null>} [weather_labels]
 *
 * @typedef {object} Forecast
 * @property {Location} location
 * @property {{ units: Record<string, string>, data: CurrentObservation }} [current]
 * @property {{ units: Record<string, string>, data: TimeSeries }} [hourly]
 * @property {{ units: Record<string, string>, data: TimeSeries }} [daily]
 *
 * @typedef {{ ok: true, forecast: Forecast } | { ok: false, status: number, reason: string }} ForecastResult
 *
 * @typedef {object} GeocodePlace
 * @property {number} id
 * @property {string} name
 * @property {number} latitude
 * @property {number} longitude
 * @property {number} [elevation]
 * @property {string} [country]
 * @property {string} [country_code]
 * @property {string} [admin1]
 * @property {string} [timezone]
 * @property {number} [population]
 * @property {string} [feature_code]
 *
 * @typedef {{ ok: true, results: GeocodePlace[] } | { ok: false, status: number, reason: string }} GeocodeResult
 */

/**
 * @param {string[]} parts
 * @returns {{ ok: true, list: string[] | null } | { ok: false, reason: string }}
 */
function boundedVariableParts(parts) {
  if (parts.length > MAX_VARIABLES) {
    return { ok: false, reason: `variable lists must have at most ${MAX_VARIABLES} names` };
  }
  for (const part of parts) {
    if (/[,&=?#\s]/.test(part)) {
      return {
        ok: false,
        reason: "variable names must not contain commas or URL delimiters",
      };
    }
    if (part.length > MAX_VARIABLE_NAME) {
      return {
        ok: false,
        reason: `variable names must be at most ${MAX_VARIABLE_NAME} characters`,
      };
    }
  }
  return { ok: true, list: parts.length === 0 ? null : parts };
}

/**
 * @param {unknown} value
 * @param {string[] | null} fallback
 * @returns {{ ok: true, list: string[] | null } | { ok: false, reason: string }}
 */
function normalizeVariableList(value, fallback) {
  if (value === undefined || value === null) {
    return { ok: true, list: fallback };
  }
  if (typeof value === "string") {
    if (value.length > MAX_VARIABLE_LIST_CHARS) {
      return {
        ok: false,
        reason: `variable lists must be at most ${MAX_VARIABLE_LIST_CHARS} characters`,
      };
    }
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return boundedVariableParts(parts);
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_VARIABLES) {
      return { ok: false, reason: `variable lists must have at most ${MAX_VARIABLES} names` };
    }
    const parts = [];
    for (const item of value) {
      if (typeof item !== "string" && typeof item !== "number") {
        return { ok: false, reason: "variable lists must contain strings" };
      }
      const part = String(item).trim();
      if (part) {
        parts.push(part);
      }
    }
    return boundedVariableParts(parts);
  }
  return {
    ok: false,
    reason: "variable lists must be an array of strings or a comma-separated string",
  };
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} min
 * @param {number} max
 * @returns {{ ok: true, n: number } | { ok: false, reason: string }}
 */
function finiteNumber(value, field, min, max) {
  let n;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    const trimmed = value.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
      return { ok: false, reason: `${field} must be a finite number` };
    }
    n = Number(trimmed);
  } else {
    return { ok: false, reason: `${field} must be a finite number` };
  }
  if (!Number.isFinite(n)) {
    return { ok: false, reason: `${field} must be a finite number` };
  }
  if (n < min || n > max) {
    return { ok: false, reason: `${field} must be between ${min} and ${max}` };
  }
  return { ok: true, n };
}

/**
 * @param {unknown} input
 * @param {{ current: string[] | null, hourly: string[] | null, daily: string[] | null }} defaults
 * @returns {{ ok: true, query: ForecastQuery } | { ok: false, status: number, reason: string }}
 */
export function parseForecastQuery(input, defaults) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, status: 400, reason: "arguments must be an object" };
  }
  const args = /** @type {Record<string, unknown>} */ (input);

  const latitude = finiteNumber(args.latitude, "latitude", -90, 90);
  if (!latitude.ok) {
    return { ok: false, status: 400, reason: latitude.reason };
  }
  const longitude = finiteNumber(args.longitude, "longitude", -180, 180);
  if (!longitude.ok) {
    return { ok: false, status: 400, reason: longitude.reason };
  }

  const current = normalizeVariableList(args.current, defaults.current);
  if (!current.ok) {
    return { ok: false, status: 400, reason: current.reason };
  }
  const hourly = normalizeVariableList(args.hourly, defaults.hourly);
  if (!hourly.ok) {
    return { ok: false, status: 400, reason: hourly.reason };
  }
  const daily = normalizeVariableList(args.daily, defaults.daily);
  if (!daily.ok) {
    return { ok: false, status: 400, reason: daily.reason };
  }

  /** @type {ForecastQuery} */
  const query = {
    latitude: latitude.n,
    longitude: longitude.n,
    current: current.list,
    hourly: hourly.list,
    daily: daily.list,
    timezone: typeof args.timezone === "string" && args.timezone.trim()
      ? args.timezone.trim()
      : "auto",
  };

  if (query.timezone.length > MAX_TIMEZONE) {
    return {
      ok: false,
      status: 400,
      reason: `timezone must be at most ${MAX_TIMEZONE} characters`,
    };
  }

  if (args.forecast_days !== undefined && args.forecast_days !== null) {
    const days = finiteNumber(args.forecast_days, "forecast_days", 1, 16);
    if (!days.ok) {
      return { ok: false, status: 400, reason: days.reason };
    }
    if (!Number.isInteger(days.n)) {
      return { ok: false, status: 400, reason: "forecast_days must be an integer from 1 to 16" };
    }
    query.forecast_days = days.n;
  }

  if (args.temperature_unit !== undefined && args.temperature_unit !== null) {
    if (typeof args.temperature_unit !== "string" || !TEMPERATURE_UNITS.has(args.temperature_unit)) {
      return {
        ok: false,
        status: 400,
        reason: "temperature_unit must be celsius or fahrenheit",
      };
    }
    query.temperature_unit = args.temperature_unit;
  }

  if (args.wind_speed_unit !== undefined && args.wind_speed_unit !== null) {
    if (typeof args.wind_speed_unit !== "string" || !WIND_SPEED_UNITS.has(args.wind_speed_unit)) {
      return {
        ok: false,
        status: 400,
        reason: "wind_speed_unit must be kmh, ms, mph, or kn",
      };
    }
    query.wind_speed_unit = args.wind_speed_unit;
  }

  if (args.precipitation_unit !== undefined && args.precipitation_unit !== null) {
    if (
      typeof args.precipitation_unit !== "string" ||
      !PRECIPITATION_UNITS.has(args.precipitation_unit)
    ) {
      return {
        ok: false,
        status: 400,
        reason: "precipitation_unit must be mm or inch",
      };
    }
    query.precipitation_unit = args.precipitation_unit;
  }

  return { ok: true, query };
}

/**
 * @param {ForecastQuery} query
 * @returns {URL}
 */
export function buildForecastUrl(query) {
  const url = new URL(FORECAST_ENDPOINT);
  url.searchParams.set("latitude", String(query.latitude));
  url.searchParams.set("longitude", String(query.longitude));
  url.searchParams.set("timezone", query.timezone);
  if (query.current) {
    url.searchParams.set("current", query.current.join(","));
  }
  if (query.hourly) {
    url.searchParams.set("hourly", query.hourly.join(","));
  }
  if (query.daily) {
    url.searchParams.set("daily", query.daily.join(","));
  }
  if (query.forecast_days !== undefined) {
    url.searchParams.set("forecast_days", String(query.forecast_days));
  }
  if (query.temperature_unit) {
    url.searchParams.set("temperature_unit", query.temperature_unit);
  }
  if (query.wind_speed_unit) {
    url.searchParams.set("wind_speed_unit", query.wind_speed_unit);
  }
  if (query.precipitation_unit) {
    url.searchParams.set("precipitation_unit", query.precipitation_unit);
  }
  return url;
}

/**
 * @param {unknown} body
 * @returns {Forecast}
 */
export function mapForecast(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("forecast body must be a JSON object");
  }
  const raw = /** @type {Record<string, unknown>} */ (body);
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("forecast is missing latitude or longitude");
  }

  /** @type {Forecast} */
  const forecast = {
    location: {
      latitude,
      longitude,
      timezone: typeof raw.timezone === "string" ? raw.timezone : "GMT",
      utc_offset_seconds: Number(raw.utc_offset_seconds) || 0,
    },
  };
  if (typeof raw.elevation === "number") {
    forecast.location.elevation = raw.elevation;
  }
  if (typeof raw.timezone_abbreviation === "string") {
    forecast.location.timezone_abbreviation = raw.timezone_abbreviation;
  }

  if (raw.current && typeof raw.current === "object" && !Array.isArray(raw.current)) {
    const current = /** @type {Record<string, unknown>} */ (raw.current);
    const units =
      raw.current_units && typeof raw.current_units === "object" && !Array.isArray(raw.current_units)
        ? /** @type {Record<string, string>} */ (raw.current_units)
        : {};
    /** @type {Record<string, number | string | null>} */
    const values = {};
    for (const [key, value] of Object.entries(current)) {
      if (CURRENT_META.has(key)) {
        continue;
      }
      values[key] = /** @type {number | string | null} */ (value);
    }
    /** @type {CurrentObservation} */
    const data = {
      time: typeof current.time === "string" ? current.time : "",
      values,
    };
    if (typeof current.interval === "number") {
      data.interval = current.interval;
    }
    if (Object.prototype.hasOwnProperty.call(values, "weather_code")) {
      data.weather_label = weatherLabel(values.weather_code);
    }
    forecast.current = { units, data };
  }

  const hourly = mapSeries(raw.hourly, raw.hourly_units);
  if (hourly) {
    forecast.hourly = hourly;
  }
  const daily = mapSeries(raw.daily, raw.daily_units);
  if (daily) {
    forecast.daily = daily;
  }
  return forecast;
}

/**
 * @param {unknown} block
 * @param {unknown} unitsBlock
 * @returns {{ units: Record<string, string>, data: TimeSeries } | null}
 */
function mapSeries(block, unitsBlock) {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    return null;
  }
  const raw = /** @type {Record<string, unknown>} */ (block);
  const time = Array.isArray(raw.time) ? raw.time.map((item) => String(item)) : [];
  /** @type {Record<string, Array<number | string | null>>} */
  const values = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SERIES_META.has(key) || !Array.isArray(value)) {
      continue;
    }
    values[key] = value.map((item) =>
      item === null || item === undefined ? null : /** @type {number | string} */ (item),
    );
  }
  /** @type {TimeSeries} */
  const data = { time, values };
  if (Object.prototype.hasOwnProperty.call(values, "weather_code")) {
    data.weather_labels = values.weather_code.map((code) => weatherLabel(code));
  }
  const units =
    unitsBlock && typeof unitsBlock === "object" && !Array.isArray(unitsBlock)
      ? /** @type {Record<string, string>} */ (unitsBlock)
      : {};
  return { units, data };
}

/**
 * @param {unknown} body
 */
function isOpenMeteoError(body) {
  return Boolean(
    body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      /** @type {Record<string, unknown>} */ (body).error === true,
  );
}

/**
 * @param {number} status
 * @param {unknown} body
 * @returns {ForecastResult}
 */
export function interpretForecastResponse(status, body) {
  if (isOpenMeteoError(body)) {
    const reason = /** @type {Record<string, unknown>} */ (body).reason;
    return {
      ok: false,
      status,
      reason: typeof reason === "string" && reason ? reason : "Open-Meteo rejected the request",
    };
  }
  if (status >= 400) {
    return { ok: false, status, reason: `Open-Meteo HTTP ${status}` };
  }
  try {
    return { ok: true, forecast: mapForecast(body) };
  } catch (err) {
    return {
      ok: false,
      status,
      reason: err instanceof Error ? err.message : "failed to map forecast",
    };
  }
}

/**
 * @param {string | URL} url
 * @returns {Promise<{ status: number, body: unknown } | { ok: false, status: number, reason: string }>}
 */
async function getJson(url) {
  let response;
  try {
    response = await fetch(String(url), {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "TimeoutError"
        ? "Open-Meteo request timed out"
        : err instanceof Error
          ? err.message
          : "network error";
    return { ok: false, status: 0, reason };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: response.status, reason: "Open-Meteo returned non-JSON" };
  }
  return { status: response.status, body };
}

/**
 * @param {unknown} args
 * @returns {Promise<ForecastResult>}
 */
export async function getForecast(args) {
  const parsed = parseForecastQuery(args, {
    current: DEFAULT_CURRENT,
    hourly: DEFAULT_HOURLY,
    daily: DEFAULT_DAILY,
  });
  if (!parsed.ok) {
    return parsed;
  }
  const fetched = await getJson(buildForecastUrl(parsed.query));
  if ("ok" in fetched && fetched.ok === false) {
    return fetched;
  }
  return interpretForecastResponse(fetched.status, fetched.body);
}

/**
 * @param {unknown} args
 * @returns {Promise<ForecastResult>}
 */
export async function getCurrentWeather(args) {
  const parsed = parseForecastQuery(args, {
    current: DEFAULT_CURRENT,
    hourly: null,
    daily: null,
  });
  if (!parsed.ok) {
    return parsed;
  }
  parsed.query.hourly = null;
  parsed.query.daily = null;
  if (parsed.query.forecast_days === undefined) {
    parsed.query.forecast_days = 1;
  }
  const fetched = await getJson(buildForecastUrl(parsed.query));
  if ("ok" in fetched && fetched.ok === false) {
    return fetched;
  }
  return interpretForecastResponse(fetched.status, fetched.body);
}

/**
 * @param {unknown} input
 * @returns {URL | { ok: false, status: number, reason: string }}
 */
export function buildGeocodeUrl(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, status: 400, reason: "arguments must be an object" };
  }
  const args = /** @type {Record<string, unknown>} */ (input);
  const name = typeof args.name === "string" ? args.name.trim() : "";
  if (!name) {
    return { ok: false, status: 400, reason: "name is required" };
  }
  if (name.length > MAX_GEOCODE_NAME) {
    return {
      ok: false,
      status: 400,
      reason: `name must be at most ${MAX_GEOCODE_NAME} characters`,
    };
  }
  let count = 5;
  if (args.count !== undefined && args.count !== null) {
    const parsed = finiteNumber(args.count, "count", 1, 10);
    if (!parsed.ok) {
      return { ok: false, status: 400, reason: parsed.reason };
    }
    if (!Number.isInteger(parsed.n)) {
      return { ok: false, status: 400, reason: "count must be an integer from 1 to 10" };
    }
    count = parsed.n;
  }
  let language = "en";
  if (typeof args.language === "string" && args.language.trim()) {
    language = args.language.trim();
    if (language.length > MAX_LANGUAGE) {
      return {
        ok: false,
        status: 400,
        reason: `language must be at most ${MAX_LANGUAGE} characters`,
      };
    }
  }
  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set("name", name);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", language);
  url.searchParams.set("format", "json");
  return url;
}

/**
 * @param {unknown} body
 * @returns {GeocodePlace[]}
 */
export function mapGeocode(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [];
  }
  const raw = /** @type {Record<string, unknown>} */ (body);
  if (!Array.isArray(raw.results)) {
    return [];
  }
  /** @type {GeocodePlace[]} */
  const places = [];
  for (const item of raw.results) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = /** @type {Record<string, unknown>} */ (item);
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    /** @type {GeocodePlace} */
    const place = {
      id: Number(row.id) || 0,
      name: typeof row.name === "string" ? row.name : "",
      latitude,
      longitude,
    };
    if (typeof row.elevation === "number") {
      place.elevation = row.elevation;
    }
    if (typeof row.country === "string") {
      place.country = row.country;
    }
    if (typeof row.country_code === "string") {
      place.country_code = row.country_code;
    }
    if (typeof row.admin1 === "string") {
      place.admin1 = row.admin1;
    }
    if (typeof row.timezone === "string") {
      place.timezone = row.timezone;
    }
    if (typeof row.population === "number") {
      place.population = row.population;
    }
    if (typeof row.feature_code === "string") {
      place.feature_code = row.feature_code;
    }
    places.push(place);
  }
  return places;
}

/**
 * @param {unknown} args
 * @returns {Promise<GeocodeResult>}
 */
export async function geocodeLocation(args) {
  const url = buildGeocodeUrl(args);
  if (!(url instanceof URL)) {
    return url;
  }
  const fetched = await getJson(url);
  if ("ok" in fetched && fetched.ok === false) {
    return fetched;
  }
  const body = fetched.body;
  if (isOpenMeteoError(body)) {
    const reason = /** @type {Record<string, unknown>} */ (body).reason;
    return {
      ok: false,
      status: fetched.status,
      reason: typeof reason === "string" && reason ? reason : "Open-Meteo geocoding rejected the request",
    };
  }
  if (fetched.status >= 400) {
    return { ok: false, status: fetched.status, reason: `Open-Meteo HTTP ${fetched.status}` };
  }
  return { ok: true, results: mapGeocode(body) };
}
