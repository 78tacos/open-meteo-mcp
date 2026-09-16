import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readLines } from "./read-lines.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = join(root, "src/server.js");

/**
 * @param {import("node:child_process").ChildProcessWithoutNullStreams} child
 * @param {object} message
 * @returns {Promise<object>}
 */
async function rpc(child, message) {
  const pending = readLines(child, 1);
  child.stdin.write(`${JSON.stringify(message)}\n`);
  const [line] = await pending;
  return line;
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

test("queued line handling writes intact NDJSON for overlapping requests", async () => {
  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  try {
    const pending = readLines(child, 3);
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "open-meteo-test", version: "1.0.0" },
        },
      })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_forecast", arguments: { latitude: 100, longitude: 13.41 } },
      })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_forecast", arguments: { latitude: -100, longitude: 13.41 } },
      })}\n`,
    );
    const [init, first, second] = await pending;
    assert.equal(init.id, 1);
    assert.equal(first.id, 2);
    assert.equal(second.id, 3);
    const firstText = first.result.content[0].text;
    const secondText = second.result.content[0].text;
    assert.equal(firstText, JSON.stringify(JSON.parse(firstText)));
    assert.equal(secondText, JSON.stringify(JSON.parse(secondText)));
    assert.equal(first.result.isError, true);
    assert.equal(second.result.isError, true);
  } finally {
    child.kill("SIGTERM");
  }
});

test("requests without a method return JSON-RPC invalid request", async () => {
  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  try {
    const pending = readLines(child, 1);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 7 })}\n`);
    const [response] = await pending;
    assert.equal(response.id, 7);
    assert.equal(response.error.code, -32600);
  } finally {
    child.kill("SIGTERM");
  }
});

test("MCP server exits when stdin is a TTY", async () => {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true }); await import("./src/server.js");',
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  const [code, stderr] = await new Promise((resolve) => {
    let err = "";
    child.stderr.on("data", (buf) => {
      err += buf.toString("utf8");
    });
    child.on("close", (exitCode) => {
      resolve([exitCode, err]);
    });
  });
  assert.equal(code, 2);
  assert.match(stderr, /MCP stdio server/);
});
