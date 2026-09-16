# Open-Meteo MCP

An [Agent Plugin](https://cursor.com/docs/plugins) that gives Cursor (and other Agent Plugin clients) Open-Meteo forecast tools. No API key. The MCP server is a Node.js stdio process with no npm dependencies.

Weather data comes from the public [Open-Meteo forecast API](https://open-meteo.com/en/docs). Place names resolve through the [geocoding API](https://geocoding-api.open-meteo.com/v1/search).

## Install in Cursor

You need Node.js 18.18 or newer (`node -v`).

### Local plugin folder

Cursor loads Agent Plugins from `~/.cursor/plugins/local` after a window reload. The folder must live inside that directory. Cursor skips a symlink that points at a repo elsewhere on disk.

1. Clone this repository.
2. Copy it into the local plugins directory:

```bash
mkdir -p ~/.cursor/plugins/local
cp -R /path/to/open-meteo-mcp ~/.cursor/plugins/local/open-meteo
```

3. Reload Cursor (**Developer: Reload Window**).
4. Open **Customize** and confirm the Open-Meteo MCP server and the `check-weather` / `compare-forecast` skills.

### Project MCP config (MCP only)

If you only want the tools in this repo, add an absolute path to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "open-meteo": {
      "command": "node",
      "args": ["/absolute/path/to/open-meteo-mcp/src/server.js"]
    }
  }
}
```

This plugin is not listed on the Cursor Marketplace or cursor.directory.

## Run and test locally

From the repo root:

```bash
npm test
node src/cli.js current --latitude 52.52 --longitude 13.41
node src/cli.js forecast --latitude 52.52 --longitude 13.41 --forecast-days 3
node src/cli.js geocode Berlin
npm run proof
```

`npm test` covers query parsing, Open-Meteo JSON mapping, WMO labels, and the MCP `initialize` / `tools/list` handshake. `npm run proof` calls live Open-Meteo for Berlin (52.52, 13.41) through the client and through MCP `tools/call`, then writes [docs/proof.md](docs/proof.md).

`npm start` (or `node src/server.js`) speaks MCP on stdio. Do not type into that process. Drive it with a client or the proof script.

## Tools

| Tool | Use for |
| --- | --- |
| `geocode_location` | Place name to lat/lon |
| `get_current_weather` | Current conditions only |
| `get_forecast` | Current plus hourly and daily series |

Coordinates are WGS84. `timezone` defaults to `auto`. `forecast_days` is 1 to 16. Units are Open-Meteo's: `temperature_unit` (`celsius` / `fahrenheit`), `wind_speed_unit` (`kmh` / `ms` / `mph` / `kn`), `precipitation_unit` (`mm` / `inch`).

If you omit variable lists, v1 sends:

- current: `temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m`
- hourly: `temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m`
- daily: `weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max`

Pass `[]` for `current`, `hourly`, or `daily` to drop that block from the request.

Every `weather_code` is labeled with the [Open-Meteo WMO WW table](https://open-meteo.com/en/docs#weather_variable_documentation). Codes outside that table come back as `Unknown WMO weather code N`.

Open-Meteo errors (`{ "error": true, "reason": "..." }`, HTTP 400) return as `{ "ok": false, "status": 400, "reason": "..." }` with MCP `isError: true`.

### Example calls

Current conditions in Berlin:

```json
{
  "name": "get_current_weather",
  "arguments": { "latitude": 52.52, "longitude": 13.41 }
}
```

Three-day daily outlook after geocoding:

```json
{
  "name": "geocode_location",
  "arguments": { "name": "Berlin", "count": 1 }
}
```

```json
{
  "name": "get_forecast",
  "arguments": {
    "latitude": 52.52,
    "longitude": 13.41,
    "forecast_days": 3,
    "hourly": []
  }
}
```

## Layout

```
plugin.json          Agent Plugin manifest
mcp.json             stdio MCP server
skills/              agent skills
src/open-meteo.js    forecast + geocode client
src/weather-codes.js WMO labels
src/tools.js         tool schemas
src/server.js        JSON-RPC stdio
src/cli.js           same client, for humans and proof
```

v1 is forecast only. No archive, air-quality, or marine endpoints.

`mcp.json` passes `${CURSOR_PLUGIN_ROOT}/src/server.js` to `node` because Cursor does not expand the Agent Plugins `${PLUGIN_ROOT}` placeholder. A project `.cursor/mcp.json` should use an absolute path instead, as in the install section.

## Attribution

Weather data by [Open-Meteo](https://open-meteo.com/). Cite Open-Meteo when you publish products that use this plugin. The public forecast endpoint is for non-commercial use under [Open-Meteo's terms](https://open-meteo.com/en/terms).

## License

MIT. See [LICENSE](LICENSE).
