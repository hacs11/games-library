import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS store_credential (
  store          TEXT PRIMARY KEY,
  data           TEXT,
  status         TEXT NOT NULL DEFAULT 'disconnected',
  last_synced_at TEXT,
  last_error     TEXT
);

CREATE TABLE IF NOT EXISTS game (
  id      INTEGER PRIMARY KEY,
  igdb_id INTEGER UNIQUE,
  title   TEXT NOT NULL,
  is_game INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS entitlement (
  id            INTEGER PRIMARY KEY,
  store         TEXT NOT NULL,
  store_game_id TEXT NOT NULL,
  store_title   TEXT NOT NULL,
  game_id       INTEGER REFERENCES game(id),
  locked        INTEGER NOT NULL DEFAULT 0,
  first_seen    TEXT NOT NULL,
  last_seen     TEXT NOT NULL,
  gfn_status    TEXT,
  UNIQUE (store, store_game_id)
);

CREATE TABLE IF NOT EXISTS gfn_entry (
  id           INTEGER PRIMARY KEY,
  gfn_id       INTEGER UNIQUE,
  title        TEXT NOT NULL,
  sort_name    TEXT,
  store        TEXT,
  steam_appid  TEXT,
  status       TEXT
);
`;

export function open(path = "data/library.db") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

// One row per Game, with the Stores it was bought in. Entitlements with no
// Game yet (unmatched) are deliberately absent — they live in the tray.
export function listGames(db) {
  return db
    .prepare(
      `SELECT g.id,
              g.title,
              group_concat(e.store, ',') AS stores,
              max(e.gfn_status = 'AVAILABLE') AS streamable
         FROM game g
         JOIN entitlement e ON e.game_id = g.id
        WHERE g.is_game = 1
        GROUP BY g.id
        ORDER BY g.title COLLATE NOCASE`,
    )
    .all()
    .map((r) => ({ ...r, stores: r.stores.split(","), streamable: !!r.streamable }));
}
