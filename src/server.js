#!/usr/bin/env node
import { createInterface } from "node:readline";
import { callTool, TOOLS } from "./tools.js";

const SERVER_INFO = { name: "open-meteo", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOLS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

let initialized = false;

/**
 * @param {unknown} id
 * @param {unknown} result
 */
function success(id, result) {
  return { jsonrpc: "2.0", id, result };
}

/**
 * @param {unknown} id
 * @param {number} code
 * @param {string} message
 */
function failure(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * @param {unknown} msg
 * @returns {Promise<object | null>}
 */
async function handleMessage(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    return failure(null, -32600, "invalid request");
  }
  const request = /** @type {Record<string, unknown>} */ (msg);
  if (request.jsonrpc !== "2.0") {
    return failure(request.id ?? null, -32600, "invalid JSON-RPC version");
  }
  if (typeof request.method !== "string") {
    return null;
  }

  const id = request.id;
  const isNotification = id === undefined;

  switch (request.method) {
    case "initialize": {
      if (isNotification) {
        return null;
      }
      const params =
        request.params && typeof request.params === "object"
          ? /** @type {Record<string, unknown>} */ (request.params)
          : {};
      const requested =
        typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION;
      const protocolVersion = SUPPORTED_PROTOCOLS.has(requested) ? requested : PROTOCOL_VERSION;
      initialized = true;
      return success(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    }
    case "notifications/initialized":
      initialized = true;
      return null;
    case "ping":
      if (isNotification) {
        return null;
      }
      return success(id, {});
    case "tools/list": {
      if (isNotification) {
        return null;
      }
      if (!initialized) {
        return failure(id, -32600, "server is not initialized");
      }
      return success(id, { tools: TOOLS });
    }
    case "tools/call": {
      if (isNotification) {
        return null;
      }
      if (!initialized) {
        return failure(id, -32600, "server is not initialized");
      }
      const params =
        request.params && typeof request.params === "object"
          ? /** @type {Record<string, unknown>} */ (request.params)
          : {};
      const name = params.name;
      if (typeof name !== "string" || !name) {
        return failure(id, -32602, "tools/call requires params.name");
      }
      const known = TOOLS.some((tool) => tool.name === name);
      if (!known) {
        return failure(id, -32602, `unknown tool: ${name}`);
      }
      try {
        const result = await callTool(name, params.arguments ?? {});
        const isError = !(result && result.ok === true);
        return success(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError,
        });
      } catch (err) {
        return success(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  status: 500,
                  reason: err instanceof Error ? err.message : "internal error",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        });
      }
    }
    default:
      if (isNotification) {
        return null;
      }
      return failure(id, -32601, `method not found: ${request.method}`);
  }
}

function start() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", async (line) => {
    if (!line.trim()) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify(failure(null, -32700, "parse error"))}\n`);
      return;
    }
    const response = await handleMessage(parsed);
    if (response) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
}

start();
