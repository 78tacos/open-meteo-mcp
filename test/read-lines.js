/**
 * @param {import("node:child_process").ChildProcessWithoutNullStreams} child
 * @param {number} count
 * @param {number} [timeoutMs]
 * @returns {Promise<object[]>}
 */
export function readLines(child, count, timeoutMs = 5000) {
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
