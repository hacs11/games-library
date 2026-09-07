import { createServer } from "node:http";
import { open, listGames, stores, saveCredential, unmatched, gameTitles } from "./db.js";
import { resolveGame } from "./match.js";
import { syncStore } from "./sync.js";
import { layout, listPage, connectPage, unmatchedPage } from "./views.js";

const db = open();

const html = (res, body) =>
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
const seeOther = (res, to) => res.writeHead(303, { location: to }).end();

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}

const page = (title, body) => layout(title, body, unmatched(db).length);

const routes = {
  "GET /": (_req, res) => html(res, page("Library", listPage(listGames(db)))),

  "GET /connect": (_req, res) => html(res, page("Connect", connectPage(stores(db)))),

  "GET /unmatched": (req, res) => {
    const after = Number(new URL(req.url, "http://x").searchParams.get("after") ?? 0);
    html(res, page("Unmatched", unmatchedPage(unmatched(db, after), gameTitles(db))));
  },

  // Confirming locks the Entitlement so no later Sync can re-guess it.
  "POST /unmatched": async (req, res) => {
    const { id, title } = await body(req);
    db.prepare("UPDATE entitlement SET game_id = ?, locked = 1, confidence = 'manual' WHERE id = ?")
      .run(resolveGame(db, title.trim()), Number(id));
    seeOther(res, "/unmatched");
  },

  "POST /connect/igdb": async (req, res) => {
    const { client_id, client_secret } = await body(req);
    saveCredential(db, "igdb", { client_id: client_id.trim(), client_secret: client_secret.trim() });
    seeOther(res, "/connect");
  },

  "POST /connect/steam": async (req, res) => {
    const { api_key, steam_id } = await body(req);
    saveCredential(db, "steam", { api_key: api_key.trim(), steam_id: steam_id.trim() });
    seeOther(res, "/connect");
  },

  "POST /sync/steam": async (_req, res) => {
    // A failed Store is recorded on its own row by syncStore; the page shows it.
    await syncStore(db, "steam").catch(() => {});
    seeOther(res, "/connect");
  },
};

createServer((req, res) => {
  const handler = routes[`${req.method} ${new URL(req.url, "http://x").pathname}`];
  if (!handler) return res.writeHead(404).end("Not found");
  Promise.resolve(handler(req, res)).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end("Server error");
  });
}).listen(3000, () => console.log("http://localhost:3000"));
