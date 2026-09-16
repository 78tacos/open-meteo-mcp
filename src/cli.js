#!/usr/bin/env node
import { geocodeLocation, getCurrentWeather, getForecast } from "./open-meteo.js";

function printHelp() {
  process.stdout.write(`Usage:
  node src/cli.js forecast --latitude <lat> --longitude <lon> [--forecast-days N]
  node src/cli.js current --latitude <lat> --longitude <lon>
  node src/cli.js geocode <name>
`);
}

/**
 * @param {string[]} argv
 */
function parseFlags(argv) {
  /** @type {Record<string, string>} */
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = "true";
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { flags, positional };
}

/**
 * @param {Record<string, string>} flags
 */
function coords(flags) {
  return {
    latitude: flags.latitude ?? flags.lat,
    longitude: flags.longitude ?? flags.lon,
    timezone: flags.timezone,
    forecast_days: flags["forecast-days"] ?? flags.forecast_days,
    temperature_unit: flags["temperature-unit"] ?? flags.temperature_unit,
    wind_speed_unit: flags["wind-speed-unit"] ?? flags.wind_speed_unit,
    precipitation_unit: flags["precipitation-unit"] ?? flags.precipitation_unit,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(command ? 0 : 2);
  }

  const { flags, positional } = parseFlags(argv.slice(1));
  let result;
  switch (command) {
    case "forecast":
      result = await getForecast(coords(flags));
      break;
    case "current":
      result = await getCurrentWeather(coords(flags));
      break;
    case "geocode": {
      const name = positional.join(" ") || flags.name;
      result = await geocodeLocation({ name, count: flags.count });
      break;
    }
    default:
      printHelp();
      process.stderr.write(`unknown command: ${command}\n`);
      process.exit(2);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result && result.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
