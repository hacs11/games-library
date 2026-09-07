import { normaliseTitle } from "./match.js";

// Pentanet's own catalogue for the Australian GeForce NOW alliance region.
// NVIDIA's static "supported-public-game-list" file was used first and is
// unusable: it lists only publishers who consented to public listing, so it
// contains no Bethesda, Microsoft or Larian titles at all. See docs/adr/0003.
const API = "https://cloud.gg/api/games/list";
const PAGE_SIZE = 100;

// NVIDIA's file is kept for one reason: its Steam entries carry the appid, and
// an appid is exact where a title is not. It adds Steam matches, never removes
// them, so a failure to fetch it is not a failed Sync.
const NVIDIA_LIST = "https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-AU.json";

// Pentanet's appStore values for the Stores we sync.
const GFN_STORE = { steam: "STEAM", gog: "GOG", epic: "EPIC", xbox: "XBOX" };

async function page(n) {
  const res = await fetch(`${API}/${n}/${PAGE_SIZE}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GeForce NOW catalogue returned ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) throw new Error("GeForce NOW returned an unexpected response");
  return json.data;
}

export async function syncGfn(db) {
  // Pages are zero-indexed: starting at 1 silently drops the first 100 games.
  const games = [];
  for (let n = 0; n < 50; n++) {
    const batch = await page(n);
    games.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  if (games.length === 0) throw new Error("GeForce NOW returned an empty catalogue");

  // Only replace the catalogue once the whole thing is in hand: a fetch that
  // dies halfway must not leave a truncated list behind.
  db.exec("DELETE FROM gfn_entry");
  const insert = db.prepare(
    "INSERT INTO gfn_entry (gfn_id, title, norm_title, store, steam_appid, status) VALUES (?, ?, ?, ?, ?, ?)",
  );
  let rows = 0;
  for (const g of games) {
    // One row per variant: support is per store, so a game streamable from GOG
    // but not Epic is two different answers.
    // Some catalogue titles arrive with leading or trailing whitespace.
    const title = g.title.trim();
    for (const v of g.variants ?? []) {
      insert.run(v.id ?? null, title, normaliseTitle(title), v.appStore ?? null, null, "AVAILABLE");
      rows++;
    }
  }

  let appids = 0;
  try {
    const res = await fetch(NVIDIA_LIST);
    for (const e of await res.json()) {
      const appid = e.steamUrl?.match(/\/app\/(\d+)/)?.[1];
      if (!appid || e.store !== "Steam") continue;
      insert.run(null, e.title.trim(), normaliseTitle(e.title), "STEAM", appid, e.status ?? "AVAILABLE");
      appids++;
    }
  } catch (err) {
    console.error(`Steam appid list unavailable, titles only: ${err.message}`);
  }

  applyGfn(db);
  db.prepare(
    `INSERT INTO store_credential (store, data, status, last_synced_at)
          VALUES ('gfn', '{}', 'connected', ?)
     ON CONFLICT (store) DO UPDATE SET status = 'connected', last_synced_at = excluded.last_synced_at, last_error = NULL`,
  ).run(new Date().toISOString());

  return { games: games.length, variants: rows, appids };
}

// Pentanet's variant ids are NVIDIA's own, not store ids, so there is nothing
// to match on but the title — per store, never across.
export function applyGfn(db) {
  const byTitle = new Map();
  const byAppid = new Map();
  for (const e of db.prepare("SELECT norm_title, store, steam_appid, status FROM gfn_entry").all()) {
    if (e.steam_appid) byAppid.set(e.steam_appid, { status: e.status, title: e.norm_title });
    if (e.store) byTitle.set(`${e.store} ${e.norm_title}`, { status: e.status, title: e.norm_title });
  }

  const update = db.prepare("UPDATE entitlement SET gfn_status = ?, gfn_title = ? WHERE id = ?");
  let matched = 0;
  for (const row of db.prepare("SELECT id, store, store_game_id, store_title FROM entitlement").all()) {
    // Steam gets the exact appid first and the title as a fallback: the appid
    // list is partial, so a miss there is not an answer.
    const hit =
      (row.store === "steam" ? byAppid.get(row.store_game_id) : null) ??
      byTitle.get(`${GFN_STORE[row.store]} ${normaliseTitle(row.store_title)}`) ??
      null;
    update.run(hit?.status ?? null, hit?.title ?? null, row.id);
    if (hit) matched++;
  }
  return matched;
}
