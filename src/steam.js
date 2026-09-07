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
  }));
}

const APPDETAILS = "https://store.steampowered.com/api/appdetails";

// Steam's storefront API is undocumented and rate limited to roughly 200
// requests per 5 minutes, so appids are fetched once and remembered — misses
// included, since a game without a Metacritic score will not grow one.
export async function fetchMetacritic(db, { limit = 250, delay = 1600 } = {}) {
  const pending = db
    .prepare(
      `SELECT DISTINCT e.store_game_id AS appid
         FROM entitlement e
        WHERE e.store = 'steam'
          AND e.store_game_id NOT IN (SELECT appid FROM steam_rating)
        LIMIT ?`,
    )
    .all(limit);

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

export const pendingCount = (db) =>
  db.prepare(
    `SELECT count(DISTINCT store_game_id) c FROM entitlement
      WHERE store = 'steam' AND store_game_id NOT IN (SELECT appid FROM steam_rating)`,
  ).get().c;
