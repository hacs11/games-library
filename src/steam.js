import { normaliseTitle } from "./match.js";
import { replaceAll } from "./db.js";
const OWNED = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";

// Steam returns an empty `response` object — not an error — when the account's
// game details are private. Treat that as a connection problem, not zero games.
export async function fetchOwnedGames({ api_key, steam_id }) {
  const url = `${OWNED}?key=${encodeURIComponent(api_key)}&steamid=${encodeURIComponent(steam_id)}&include_appinfo=1&include_played_free_games=1&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam returned ${res.status} ${res.statusText}`);

  const { response } = await res.json();
  if (!response?.games) {
    throw new Error(
      "Steam returned no game list. Set your profile's Game Details to Public, or check the SteamID.",
    );
  }
  return response.games.map((g) => ({
    store_game_id: String(g.appid),
    store_title: g.name,
    playtime_minutes: g.playtime_forever ?? 0,
  }));
}

const APPDETAILS = "https://store.steampowered.com/api/appdetails";

// Steam's storefront API is undocumented and rate limited to roughly 200
// requests per 5 minutes, so appids are fetched once and remembered — misses
// included, since a game without a Metacritic score will not grow one.
export async function fetchMetacritic(db, { limit = 250, delay = 1600 } = {}) {
  const pending = db.prepare(`${PENDING} ORDER BY pri LIMIT ?`).all(limit);

  const remember = db.prepare(
    "INSERT OR REPLACE INTO steam_rating (appid, score, url, fetched_at) VALUES (?, ?, ?, ?)",
  );

  let found = 0;
  for (const [i, row] of pending.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(`${APPDETAILS}?appids=${row.appid}&filters=basic,metacritic&cc=au`);
      // 429 means the window is exhausted: stop and keep what we have rather
      // than hammering, since the rest can be picked up on the next Sync.
      if (res.status === 429) break;
      if (!res.ok) continue;

      const m = (await res.json())?.[row.appid]?.data?.metacritic ?? null;
      remember.run(row.appid, m?.score ?? null, m?.url ?? null, new Date().toISOString());
      if (m?.score) found++;
    } catch {
      // A single failed appid is not worth failing a Sync over; it stays
      // pending and is retried next time.
    }
  }
  return { asked: pending.length, found, remaining: pendingCount(db) };
}

// What still needs a score: the Steam Entitlements you own, then the Steam
// titles in the Discover catalogue. Scoped through gfn_entry the way pricing
// is — steam_app holds the whole of Steam, which is a hundred thousand appids
// nobody will ever look at. Owned appids sort first (pri 0): one request each
// at ~1.6s, so the Library's own scores must not queue behind the catalogue's.
// ponytail: one appid per request is Steam's own limit; a batched endpoint for
// metacritic would replace this whole sweep if one ever appears.
const PENDING = `SELECT appid, min(pri) AS pri FROM (
         SELECT store_game_id AS appid, 0 AS pri FROM entitlement WHERE store = 'steam'
          UNION ALL
         SELECT a.appid, 1 FROM gfn_entry g
           JOIN steam_app a ON a.norm_title = g.norm_title
          WHERE g.store = 'STEAM'
       )
       WHERE appid NOT IN (SELECT appid FROM steam_rating)
       GROUP BY appid`;

export const pendingCount = (db) =>
  db.prepare(`SELECT count(*) c FROM (${PENDING})`).get().c;

// Steam's catalogue, used to turn a GeForce NOW title into an appid so it can
// be priced. Needs the API key. A title claimed by more than one app is
// dropped: demos, editions and soundtracks share names, and pricing the wrong
// one is worse than pricing nothing.
export async function syncAppIds(db, credentials) {
  const { api_key } = credentials;
  const byName = new Map();
  const ambiguous = new Set();

  let last = 0;
  for (let page = 0; page < 40; page++) {
    const url = `https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${encodeURIComponent(api_key)}&include_games=true&max_results=50000&last_appid=${last}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Steam app list returned ${res.status} ${res.statusText}`);
    const { response } = await res.json();

    for (const app of response?.apps ?? []) {
      const key = normaliseTitle(app.name ?? "");
      if (!key) continue;
      if (byName.has(key) && byName.get(key) !== String(app.appid)) ambiguous.add(key);
      else byName.set(key, String(app.appid));
    }
    if (!response?.have_more_results) break;
    last = response.last_appid;
  }

  const insert = db.prepare("INSERT OR REPLACE INTO steam_app (norm_title, appid) VALUES (?, ?)");
  // One transaction: the whole of Steam is deleted and re-inserted here, and a
  // Discover page rendered in the middle would find no prices and no scores.
  const stored = replaceAll(db, () => {
    db.exec("DELETE FROM steam_app");
    let n = 0;
    for (const [key, appid] of byName) {
      if (ambiguous.has(key)) continue;
      insert.run(key, appid);
      n++;
    }
    return n;
  });
  return { apps: byName.size, ambiguous: ambiguous.size, stored };
}

// appdetails takes 100 appids at a time when asked only for price, so the
// whole catalogue costs about twenty requests rather than two thousand.
export async function fetchPrices(db, { delay = 1200 } = {}) {
  const appids = db
    .prepare(
      `SELECT DISTINCT a.appid
         FROM gfn_entry g
         JOIN steam_app a ON a.norm_title = g.norm_title
        WHERE g.store = 'STEAM'`,
    )
    .all()
    .map((r) => r.appid);

  const save = db.prepare(
    `INSERT OR REPLACE INTO catalogue_price
       (store, store_id, currency, final_cents, initial_cents, discount_percent, formatted, fetched_at)
       VALUES ('steam', ?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = new Date().toISOString();
  let priced = 0;
  for (let i = 0; i < appids.length; i += 100) {
    const batch = appids.slice(i, i + 100);
    if (i > 0) await new Promise((r) => setTimeout(r, delay));
    const res = await fetch(
      `${APPDETAILS}?appids=${batch.join(",")}&filters=price_overview&cc=au&l=en`,
    );
    if (res.status === 429) break;
    if (!res.ok) continue;

    const json = await res.json().catch(() => ({}));
    for (const appid of batch) {
      const p = json?.[appid]?.data?.price_overview;
      // A free or unpriced app is recorded as a null price, not skipped, so it
      // is not re-asked on every refresh.
      save.run(
        appid,
        p?.currency ?? null,
        p?.final ?? null,
        p?.initial ?? null,
        p?.discount_percent ?? null,
        p?.final_formatted ?? null,
        now,
      );
      if (p?.final != null) priced++;
    }
  }
  return { asked: appids.length, priced };
}
