#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geocodeLocation, getCurrentWeather, getForecast } from "../src/open-meteo.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BERLIN = { latitude: 52.52, longitude: 13.41 };

/**
 * @param {object} message
 * @param {number} [timeoutMs]
 */
async function mcpCall(message, timeoutMs = 20_000) {
  const child = spawn(process.execPath, [join(root, "src/server.js")], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stderr = [];
  child.stderr.on("data", (buf) => {
    stderr.push(buf.toString("utf8"));
  });

  const send = (payload) => {
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  };

  const read = () =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("MCP response timed out")), timeoutMs);
      const onData = (buf) => {
        const line = buf
          .toString("utf8")
          .split("\n")
          .find((entry) => entry.trim());
        if (!line) {
          return;
        }
        clearTimeout(timer);
        child.stdout.off("data", onData);
        try {
          resolve(JSON.parse(line));
        } catch (err) {
          reject(err);
        }
      };
      child.stdout.on("data", onData);
    });

  try {
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "open-meteo-proof", version: "1.0.0" },
      },
    });
    const init = await read();
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send(message);
    const response = await read();
    return { init, response, stderr: stderr.join("") };
  } finally {
    child.kill("SIGTERM");
  }
}

function excerptForecast(forecast) {
  return {
    location: forecast.location,
    current: forecast.current
      ? {
          time: forecast.current.data.time,
          temperature_2m: forecast.current.data.values.temperature_2m,
          weather_code: forecast.current.data.values.weather_code,
          weather_label: forecast.current.data.weather_label,
          units: forecast.current.units,
        }
      : undefined,
    daily: forecast.daily
      ? {
          time: forecast.daily.data.time.slice(0, 3),
          weather_labels: forecast.daily.data.weather_labels?.slice(0, 3),
          temperature_2m_max: forecast.daily.data.values.temperature_2m_max?.slice(0, 3),
          temperature_2m_min: forecast.daily.data.values.temperature_2m_min?.slice(0, 3),
        }
      : undefined,
  };
}

async function main() {
  const started = new Date().toISOString();
  const forecast = await getForecast({ ...BERLIN, forecast_days: 3 });
  const current = await getCurrentWeather(BERLIN);
  const geocode = await geocodeLocation({ name: "Berlin", count: 1 });

  const mcp = await mcpCall({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "get_current_weather",
      arguments: BERLIN,
    },
  });

  const mcpPayload = mcp.response?.result?.content?.[0]?.text
    ? JSON.parse(mcp.response.result.content[0].text)
    : mcp.response;

  const ok =
    forecast.ok === true &&
    current.ok === true &&
    geocode.ok === true &&
    geocode.results[0]?.name === "Berlin" &&
    mcp.init?.result?.serverInfo?.name === "open-meteo" &&
    mcp.response?.result?.isError === false &&
    mcpPayload?.ok === true &&
    mcpPayload?.forecast?.current?.data?.weather_label;

  const lines = [
    "# Local proof",
    "",
    `Captured ${started} against live Open-Meteo.`,
    "",
    "Target: Berlin `latitude=52.52`, `longitude=13.41`.",
    "",
    "## Client",
    "",
    "```json",
    JSON.stringify(
      {
        forecast: forecast.ok ? excerptForecast(forecast.forecast) : forecast,
        current: current.ok ? excerptForecast(current.forecast) : current,
        geocode: geocode.ok ? geocode.results[0] : geocode,
      },
      null,
      2,
    ),
    "```",
    "",
    "## MCP stdio",
    "",
    "`initialize` then `tools/call` `get_current_weather` for the same coordinates.",
    "",
    "```json",
    JSON.stringify(
      {
        serverInfo: mcp.init?.result?.serverInfo,
        protocolVersion: mcp.init?.result?.protocolVersion,
        isError: mcp.response?.result?.isError,
        current: mcpPayload?.ok ? excerptForecast(mcpPayload.forecast) : mcpPayload,
      },
      null,
      2,
    ),
    "```",
    "",
    ok
      ? "Result: all checks passed (client forecast, current, geocode, MCP tool call)."
      : "Result: FAILED. Re-run `npm run proof`.",
    "",
    "Re-run: `node scripts/proof.js` or `npm run proof`.",
    "",
  ];

  writeFileSync(join(root, "docs/proof.md"), `${lines.join("\n")}\n`);
  process.stdout.write(`${lines.join("\n")}\n`);
  if (!ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
