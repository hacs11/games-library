import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import {
  open, listGames, stores, saveCredential, unmatched, gameTitles, gameById, gameByTitle,
  discoverGames, discoverCount, discoverDetail, hiddenCount, staleSources, genreList, ratingCounts,
  ownedCount, gameDetail, countGames, priceCounts, credential, toggleWatch, watchCount,
} from "./db.js";
import { syncStore } from "./sync.js";
import { syncGfn, applyGfn } from "./gfn.js";
import { fetchMetacritic, pendingCount, syncAppIds, fetchPrices } from "./steam.js";
import { matchEntitlements, mergeGames, rateGames, resolveGame } from "./match.js";
import { identify, identifyByName, criticScores } from "./igdb.js";
import * as gog from "./gog.js";
import * as epic from "./epic.js";
import * as xbox from "./xbox.js";
import {
  layout, listPage, connectPage, unmatchedPage, xboxPage, mergePage, discoverPage, detailPanel,
  discoverPanel,
} from "./views.js";

const STORE_OAUTH = { gog, epic };
const db = open();

const html = (res, body) =>
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
const seeOther = (res, to) => res.writeHead(303, { location: to }).end();

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}

const page = (title, content, path, extra = {}) =>
  layout(title, content, { path, pending: unmatched(db).length, ...extra });

const entitlementCounts = () =>
  Object.fromEntries(
    db.prepare("SELECT store, count(*) c FROM entitlement GROUP BY store").all().map((r) => [r.store, r.c]),
  );

const routes = {
  "GET /": (req, res) => {
    const p = new URL(req.url, "http://x").searchParams;
    const filters = {
      q: p.get("q") ?? "",
      store: p.get("store") ?? "",
      genre: p.get("genre") ?? "",
      sort: p.get("sort") ?? "",
      minScore: Number(p.get("minScore")) || 0,
      gfn: p.get("gfn") === "1",
      all: p.get("all") === "1",
    };
    const limit = p.get("limit") === "all" ? 0 : 240;
    // The view mode lives in the URL and is remembered in a cookie, so a link
    // carries the view and a return visit keeps the last one chosen.
    const cookie = /view=(grid|rows)/.exec(req.headers.cookie ?? "")?.[1];
    const view = p.get("view") === "rows" || (!p.get("view") && cookie === "rows") ? "rows" : "grid";

    const selected = p.get("game") ? gameDetail(db, p.get("game")) : null;
    const closeHref = `/${queryString({ ...filters, view, limit: p.get("limit") ?? "" })}`;

    res.setHeader("set-cookie", `view=${view}; Path=/; Max-Age=31536000; SameSite=Lax`);
    html(
      res,
      page("Library", listPage(listGames(db, filters, limit), filters, {
        matching: countGames(db, filters),
        hidden: hiddenCount(db),
        stale: staleSources(db),
        genres: genreList(db),
        total: ownedCount(db),
        view,
      }), "/", { panel: detailPanel(selected, closeHref) }),
    );
  },

  "GET /nocturne.css": async (_req, res) => {
    const css = await readFile(new URL("../static/nocturne.css", import.meta.url));
    res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "max-age=3600" }).end(css);
  },

  "GET /connect": (_req, res) =>
    html(
      res,
      page(
        "Connect",
        connectPage(stores(db), pendingCount(db), ratingCounts(db), {
          ...entitlementCounts(),
          gfn: db.prepare("SELECT count(*) c FROM gfn_entry").get().c,
          prices: priceCounts(db),
        }),
        "/connect",
      ),
      "/connect",
    ),

  "GET /discover": (req, res) => {
    const p = new URL(req.url, "http://x").searchParams;
    const filters = {
      q: p.get("q") ?? "",
      store: p.get("store") ?? "",
      sale: p.get("sale") === "1",
      watch: p.get("watch") === "1",
      sort: p.get("sort") ?? "",
      genre: p.get("genre") ?? "",
    };
    // Same shape as the Library panel: its own URL, so it is linkable and the
    // back button closes it.
    const selected = p.get("title") ? discoverDetail(db, p.get("title")) : null;
    html(
      res,
      page("Discover", discoverPage(discoverGames(db, filters), filters, discoverCount(db, filters), watchCount(db), genreList(db, "gfn_entry")), "/discover", {
        panel: discoverPanel(selected, `/discover${queryString(filters)}`),
      }),
    );
  },

  // Starring returns to the exact Discover URL it was pressed on, so the
  // filters and any open panel survive the round trip.
  "POST /watch": async (req, res) => {
    const { title, back = "/discover" } = await body(req);
    toggleWatch(db, title);
    seeOther(res, back.startsWith("/discover") ? back : "/discover");
  },

  "GET /unmatched": (req, res) => {
    const after = Number(new URL(req.url, "http://x").searchParams.get("after") ?? 0);
    html(res, page("Unmatched", unmatchedPage(unmatched(db, after), gameTitles(db)), "/unmatched"));
  },

  // Confirming locks the Entitlement so no later Sync can re-guess it.
  "POST /unmatched": async (req, res) => {
    const { id, title } = await body(req);
    db.prepare("UPDATE entitlement SET game_id = ?, locked = 1, confidence = 'manual' WHERE id = ?")
      .run(resolveGame(db, title.trim()), Number(id));
    seeOther(res, "/unmatched");
  },

  "GET /merge": (req, res) => {
    const from = gameById(db, new URL(req.url, "http://x").searchParams.get("from"));
    if (!from) return seeOther(res, "/");
    html(res, page("Merge", mergePage(from, gameTitles(db)), "/"));
  },

  "POST /merge": async (req, res) => {
    const { from, into } = await body(req);
    const target = gameByTitle(db, (into ?? "").trim());
    if (target) mergeGames(db, from, target.id);
    seeOther(res, target ? "/" : `/merge?from=${encodeURIComponent(from)}`);
  },

  "GET /xbox": (_req, res) => {
    const items = xbox.list(db);
    html(res, page("Xbox", xboxPage(items, {
      owned: items.length,
      streamable: items.filter((i) => i.gfn_status === "AVAILABLE").length,
      shared: db.prepare(
        `SELECT count(*) c FROM entitlement x WHERE x.store = 'xbox'
           AND EXISTS (SELECT 1 FROM entitlement o WHERE o.game_id = x.game_id AND o.store <> 'xbox')`,
      ).get().c,
    }), "/xbox"));
  },

  // Pasted titles are matched immediately: Xbox has no Sync to do it later.
  "POST /xbox/add": async (req, res) => {
    const { pasted } = await body(req);
    if (pasted?.trim()) {
      xbox.addTitles(db, pasted);
      await matchEntitlements(db, xbox.XBOX, identify, identifyByName);
      applyGfn(db);
    }
    seeOther(res, "/xbox");
  },

  "POST /xbox/remove": async (req, res) => {
    xbox.remove(db, (await body(req)).id);
    seeOther(res, "/xbox");
  },

  // Rate limited to ~200 requests per 5 minutes, so this is its own action
  // rather than part of a Sync, and picks up where it left off.
  // Resolving 185k Steam apps then pricing ~1,900 of them: minutes, not
  // seconds, so it is a button rather than part of any Sync.
  "POST /prices": async (_req, res) => {
    const cred = credential(db, "steam");
    if (cred?.data) {
      await syncAppIds(db, cred.data).catch((err) => console.error(err.message));
      await fetchPrices(db).catch((err) => console.error(err.message));
    }
    // GOG's catalogue is unauthenticated, so it runs whether or not Steam is
    // connected — and one store failing must not cost you the other's prices.
    await gog.syncCatalogue(db).catch((err) => console.error(err.message));
    await xbox.syncCatalogue(db).catch((err) => console.error(err.message));
    seeOther(res, "/connect");
  },

  "POST /ratings": async (_req, res) => {
    await fetchMetacritic(db).catch((err) => console.error(err.message));
    await rateGames(db, criticScores).catch((err) => console.error(err.message));
    seeOther(res, "/connect");
  },

  "POST /connect/steam": async (req, res) => {
    const { api_key, steam_id } = await body(req);
    const saved = credential(db, "steam")?.data ?? {};
    saveCredential(db, "steam", { api_key: api_key.trim() || saved.api_key, steam_id: steam_id.trim() });
    seeOther(res, "/connect");
  },

  "POST /connect/igdb": async (req, res) => {
    const { client_id, client_secret } = await body(req);
    const saved = credential(db, "igdb")?.data ?? {};
    saveCredential(db, "igdb", {
      client_id: client_id.trim(),
      client_secret: client_secret.trim() || saved.client_secret,
    });
    seeOther(res, "/connect");
  },

  ...Object.fromEntries(
    Object.entries(STORE_OAUTH).map(([store, api]) => [
      `POST /connect/${store}`,
      async (req, res) => {
        const code = api.extractCode((await body(req)).pasted ?? "");
        if (code) {
          await api
            .exchangeCode(code)
            .then((tokens) => saveCredential(db, store, tokens))
            .catch((err) =>
              db
                .prepare("UPDATE store_credential SET status='needs_reauth', last_error=? WHERE store=?")
                .run(err.message, store),
            );
        }
        seeOther(res, "/connect");
      },
    ]),
  ),
};

function queryString(filters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== "" && v !== false && v !== 0 && v != null) p.set(k, v === true ? "1" : v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

// Every Store syncs through the same route; a failure is recorded on that
// Store's own row by syncStore, and the Connect page shows it.
const syncRoute = (path) => {
  const store = path.match(/^\/sync\/(\w+)$/)?.[1];
  // GeForce NOW is a public catalogue, not a Store with a Connection.
  if (store === "gfn") {
    return (_req, res) =>
      syncGfn(db)
        .catch((err) =>
          db
            .prepare(
              `INSERT INTO store_credential (store, status, last_error) VALUES ('gfn', 'error', ?)
                 ON CONFLICT (store) DO UPDATE SET status = 'error', last_error = excluded.last_error`,
            )
            .run(err.message),
        )
        .then(() => seeOther(res, "/connect"));
  }
  return store && ((_req, res) => syncStore(db, store).catch(() => {}).then(() => seeOther(res, "/connect")));
};

// A form POST needs no CORS preflight, so any page the browser happens to be
// on could aim one at localhost:3000 — and every write here is destructive
// (hand-typed Xbox Entitlements cannot be re-synced, docs/adr/0002). Only a
// navigation that came from this app may write. Clients that send no fetch
// metadata at all (curl, a script) are not a browser being used against you.
const sameOrigin = (req) => {
  const site = req.headers["sec-fetch-site"];
  if (site) return site === "same-origin";
  const origin = req.headers.origin;
  return !origin || origin === `http://${req.headers.host}`;
};

createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (req.method === "POST" && !sameOrigin(req)) return res.writeHead(403).end("Cross-origin POST refused");
  const handler =
    routes[`${req.method} ${path}`] || (req.method === "POST" ? syncRoute(path) : null);
  if (!handler) return res.writeHead(404).end("Not found");
  Promise.resolve(handler(req, res)).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end("Server error");
  });
}).listen(3000, () => console.log("http://localhost:3000"));
