import { credential } from "./db.js";
import { resolveGame } from "./match.js";
import { fetchOwnedGames } from "./steam.js";

const FETCHERS = { steam: fetchOwnedGames };

// Each Store syncs alone: a failure marks that Store and leaves every other
// Store's Entitlements untouched. Entitlements that stop appearing keep their
// old last_seen and are never deleted.
export async function syncStore(db, store, fetcher = FETCHERS[store]) {
  const cred = credential(db, store);
  if (!cred?.data) throw new Error(`${store} is not connected`);

  let entitlements;
  try {
    entitlements = await fetcher(cred.data);
  } catch (err) {
    db.prepare(
      "UPDATE store_credential SET status = 'error', last_error = ? WHERE store = ?",
    ).run(err.message, store);
    throw err;
  }

  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO entitlement (store, store_game_id, store_title, game_id, first_seen, last_seen)
          VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (store, store_game_id) DO UPDATE SET
          store_title = excluded.store_title,
          last_seen   = excluded.last_seen,
          game_id     = CASE WHEN entitlement.locked = 1 THEN entitlement.game_id ELSE excluded.game_id END`,
  );

  for (const e of entitlements) {
    upsert.run(store, e.store_game_id, e.store_title, resolveGame(db, e.store_title), now, now);
  }

  db.prepare(
    "UPDATE store_credential SET status = 'connected', last_synced_at = ?, last_error = NULL WHERE store = ?",
  ).run(now, store);

  return entitlements.length;
}
