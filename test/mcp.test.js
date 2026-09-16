import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = join(root, "src/server.js");

/**
 * @param {import("node:child_process").ChildProcessWithoutNullStreams} child
 * @param {object} message
 * @returns {Promise<object>}
 */
function rpc(child, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.stdout.off("data", onData);
      reject(new Error("MCP response timed out"));
    }, 5000);
    const onData = (buf) => {
      const text = buf.toString("utf8");
      const line = text.split("\n").find((entry) => entry.trim());
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
    child.stdin.write(`${JSON.stringify(message)}\n`);
  });
}

test("MCP initialize then tools/list names the three Open-Meteo tools", async () => {
  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  try {
    const init = await rpc(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "open-meteo-test", version: "1.0.0" },
      },
    });
    assert.equal(init.result.serverInfo.name, "open-meteo");
    assert.equal(init.result.protocolVersion, "2025-03-26");
    assert.deepEqual(Object.keys(init.result.capabilities.tools), ["listChanged"]);

    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );

    const listed = await rpc(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    assert.deepEqual(
      listed.result.tools.map((tool) => tool.name),
      ["get_forecast", "get_current_weather", "geocode_location"],
    );
  } finally {
    child.kill("SIGTERM");
  }
});
