// A stand-in for the Supabase REST API, for the server side of the e2e run.
//
// Browser requests are intercepted in the page (support.ts: mockSupabase).
// The assistant is different: its server function reads the board from the
// Node process, where page-level interception does not reach. Without this,
// the e2e server had no board and the only thing the suite could check about
// the assistant was that it failed politely.
//
// Serves e2e/.generated/board.json (written by global-setup.ts from the real
// pipeline) and applies the three things the assistant's queries rely on:
// archived=eq.false, order=created_at.desc and limit.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const PORT = Number(process.env.BOARD_STUB_PORT || 54329);
const FIXTURE = path.join(import.meta.dirname, ".generated", "board.json");

/** Read on every request: the fixture is generated after this process starts. */
function load() {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/health") return send(200, { ok: true });

  const table = /^\/rest\/v1\/(\w+)$/.exec(url.pathname)?.[1];
  if (req.method !== "GET" || !table) return send(404, { message: "not found" });

  let fixture;
  try {
    fixture = load();
  } catch {
    return send(503, { message: "fixture not generated yet" });
  }
  let rows = fixture[table];
  if (!Array.isArray(rows)) return send(404, { message: `no table ${table}` });

  if (url.searchParams.get("archived") === "eq.false") {
    rows = rows.filter((r) => r.archived === false);
  }
  if (url.searchParams.get("order") === "created_at.desc") {
    rows = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  const limit = Number(url.searchParams.get("limit"));
  if (Number.isInteger(limit) && limit > 0) rows = rows.slice(0, limit);
  return send(200, rows);
});

server.listen(PORT, "127.0.0.1", () => console.log(`board stub on http://127.0.0.1:${PORT}`));
