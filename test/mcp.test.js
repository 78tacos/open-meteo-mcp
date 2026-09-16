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

/**
 * @param {import("node:child_process").ChildProcessWithoutNullStreams} child
 * @param {number} count
 * @param {number} [timeoutMs]
 * @returns {Promise<object[]>}
 */
function readLines(child, count, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let buf = "";
    /** @type {object[]} */
    const lines = [];
    const timer = setTimeout(() => {
      child.stdout.off("data", onData);
      reject(new Error("MCP response timed out"));
    }, timeoutMs);
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      let nl;
      while (lines.length < count && (nl = buf.indexOf("\n")) !== -1) {
        const raw = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!raw) {
          continue;
        }
        try {
          lines.push(JSON.parse(raw));
        } catch (err) {
          clearTimeout(timer);
          child.stdout.off("data", onData);
          reject(err);
          return;
        }
      }
      if (lines.length >= count) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolve(lines);
      }
    };
    child.stdout.on("data", onData);
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
