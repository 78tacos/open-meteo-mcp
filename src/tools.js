import {
  geocodeLocation,
  getCurrentWeather,
  getForecast,
  MAX_GEOCODE_NAME,
  MAX_LANGUAGE,
  MAX_TIMEZONE,
  MAX_VARIABLE_LIST_CHARS,
  MAX_VARIABLE_NAME,
  MAX_VARIABLES,
} from "./open-meteo.js";

const LATITUDE = {
  type: "number",
  minimum: -90,
  maximum: 90,
  description: "WGS84 latitude in degrees.",
};

const LONGITUDE = {
  type: "number",
  minimum: -180,
  maximum: 180,
  description: "WGS84 longitude in degrees.",
};

const VARIABLE_LIST = {
  oneOf: [
    {
      type: "array",
      items: { type: "string", maxLength: MAX_VARIABLE_NAME },
      maxItems: MAX_VARIABLES,
    },
    { type: "string", maxLength: MAX_VARIABLE_LIST_CHARS },
  ],
  description:
    "Open-Meteo variable names as an array or a comma-separated string. Omit to use v1 defaults. Pass [] or \"\" to omit this block from the request.",
};

const UNIT_PROPS = {
  timezone: {
    type: "string",
    maxLength: MAX_TIMEZONE,
    description: 'IANA timezone or "auto". Defaults to auto.',
  },
  forecast_days: {
    type: "integer",
    minimum: 1,
    maximum: 16,
    description: "Number of forecast days (1 to 16). Open-Meteo default is 7.",
  },
  temperature_unit: {
    type: "string",
    enum: ["celsius", "fahrenheit"],
  },
  wind_speed_unit: {
    type: "string",
    enum: ["kmh", "ms", "mph", "kn"],
  },
  precipitation_unit: {
    type: "string",
    enum: ["mm", "inch"],
  },
};

/** @type {Array<{ name: string, description: string, inputSchema: object }>} */
export const TOOLS = [
  {
    name: "get_forecast",
    description:
      "Fetch an Open-Meteo forecast for one lat/lon. Returns current, hourly, and daily blocks with units, plus WMO weather_code labels. Defaults: current (temperature_2m, relative_humidity_2m, apparent_temperature, precipitation, weather_code, wind_speed_10m, wind_direction_10m), hourly (temperature_2m, precipitation_probability, precipitation, weather_code, wind_speed_10m), daily (weather_code, temperature_2m_max, temperature_2m_min, precipitation_sum, precipitation_probability_max), timezone auto.",
    inputSchema: {
      type: "object",
      required: ["latitude", "longitude"],
      properties: {
        latitude: LATITUDE,
        longitude: LONGITUDE,
        current: VARIABLE_LIST,
        hourly: VARIABLE_LIST,
        daily: VARIABLE_LIST,
        ...UNIT_PROPS,
      },
    },
  },
  {
    name: "get_current_weather",
    description:
      "Fetch current conditions for one lat/lon (no hourly or daily series). Same current defaults as get_forecast. Use geocode_location first when the user named a place instead of coordinates.",
    inputSchema: {
      type: "object",
      required: ["latitude", "longitude"],
      properties: {
        latitude: LATITUDE,
        longitude: LONGITUDE,
        current: VARIABLE_LIST,
        timezone: UNIT_PROPS.timezone,
        temperature_unit: UNIT_PROPS.temperature_unit,
        wind_speed_unit: UNIT_PROPS.wind_speed_unit,
        precipitation_unit: UNIT_PROPS.precipitation_unit,
      },
    },
  },
  {
    name: "geocode_location",
    description:
      "Resolve a place name to latitude/longitude via the Open-Meteo geocoding API. Returns ranked matches (name, lat, lon, country, admin1, timezone). Call this before forecast tools when the user gives a city or address instead of coordinates.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
          maxLength: MAX_GEOCODE_NAME,
          description: "Place name, for example Berlin or San Francisco.",
        },
        count: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Max matches to return. Default 5.",
        },
        language: {
          type: "string",
          maxLength: MAX_LANGUAGE,
          description: "IETF language tag for localized names. Default en.",
        },
      },
    },
  },
];

/**
 * @param {string} name
 * @param {unknown} args
 * @returns {Promise<object>}
 */
export async function callTool(name, args) {
  switch (name) {
    case "get_forecast":
      return getForecast(args ?? {});
    case "get_current_weather":
      return getCurrentWeather(args ?? {});
    case "geocode_location":
      return geocodeLocation(args ?? {});
    default: {
      const _exhaustive = /** @type {never} */ (name);
      return {
        ok: false,
        status: 404,
        reason: `unknown tool: ${String(_exhaustive)}`,
      };
    }
  }
}
