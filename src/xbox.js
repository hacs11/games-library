import { normaliseTitle } from "./match.js";

// Xbox has no reachable "what do I own" endpoint, so its Entitlements are typed
// in by hand (docs/adr/0002). There is no Sync to correct a mistake with, which
// is why these are the only Entitlements the app lets you delete.
export const XBOX = "xbox";

// The normalised title is the id: pasting the same list twice must not create
// duplicates, and there is no store id to use instead.
const idFor = (title) => normaliseTitle(title).replace(/ /g, "-");

export function addTitles(db, pasted) {
  const titles = pasted
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && normaliseTitle(t).length > 0);

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO entitlement (store, store_game_id, store_title, first_seen, last_seen)
          VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (store, store_game_id) DO UPDATE SET store_title = excluded.store_title`,
  );

  const before = count(db);
  for (const title of titles) insert.run(XBOX, idFor(title), title, now, now);
  return { pasted: titles.length, added: count(db) - before };
}

export const count = (db) =>
  db.prepare("SELECT count(*) c FROM entitlement WHERE store = ?").get(XBOX).c;

export const list = (db) =>
  db
    .prepare(
      `SELECT e.id, e.store_title, e.gfn_status, g.title AS game
         FROM entitlement e
         LEFT JOIN game g ON g.id = e.game_id
        WHERE e.store = ?
        ORDER BY e.store_title COLLATE NOCASE`,
    )
    .all(XBOX);

export function remove(db, id) {
  db.prepare("DELETE FROM entitlement WHERE id = ? AND store = ?").run(Number(id), XBOX);
  // A Game exists only to hold Entitlements.
  db.exec("DELETE FROM game WHERE id NOT IN (SELECT game_id FROM entitlement WHERE game_id IS NOT NULL)");
}
