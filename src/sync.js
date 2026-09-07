import { credential } from "./db.js";
import { matchEntitlements, classifyGames, enrichGames, rateGames } from "./match.js";
import { identify, identifyByName, gameTypes, artwork, criticScores } from "./igdb.js";
import { fetchOwnedGames as steam } from "./steam.js";
import { fetchOwnedGames as gog } from "./gog.js";
import { fetchOwnedGames as epic } from "./epic.js";

const FETCHERS = { steam, gog, epic };

// Each Store syncs alone: a failure marks that Store and leaves every other
// Store's Entitlements untouched. Entitlements that stop appearing keep their
// old last_seen and are never deleted.
export async function syncStore(db, store, fetcher = FETCHERS[store]) {
  const cred = credential(db, store);
  if (!cred?.data) throw new Error(`${store} is not connected`);

  let entitlements;
  try {
    entitlements = await fetcher(cred.data, db);
  } catch (err) {
    // An expired login is a different problem from a broken Sync: it needs you,
    // not a retry.
    db.prepare("UPDATE store_credential SET status = ?, last_error = ? WHERE store = ?").run(
      err.reauth ? "needs_reauth" : "error",
      err.message,
      store,
    );
    throw err;
  }

  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO entitlement (store, store_game_id, store_title, alt_id, game_id, first_seen, last_seen)
          VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (store, store_game_id) DO UPDATE SET
          store_title = excluded.store_title,
          alt_id      = excluded.alt_id,
          last_seen   = excluded.last_seen,
          game_id     = CASE WHEN entitlement.locked = 1 THEN entitlement.game_id ELSE excluded.game_id END`,
  );

  // game_id is left null: matchEntitlements owns the assignment. Guessing a
  // Game here only to overwrite it a moment later abandons the row it created.
  for (const e of entitlements) {
    upsert.run(store, e.store_game_id, e.store_title, e.alt_id ?? null, null, now, now);
  }

  await matchEntitlements(db, store, identify, identifyByName);
  await classifyGames(db, gameTypes);
  await enrichGames(db, artwork);
  await rateGames(db, criticScores);

  db.prepare(
    "UPDATE store_credential SET status = 'connected', last_synced_at = ?, last_error = NULL WHERE store = ?",
  ).run(now, store);

  return entitlements.length;
}
