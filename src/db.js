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
  id         INTEGER PRIMARY KEY,
  igdb_id    INTEGER UNIQUE,
  title      TEXT NOT NULL,
  norm_title TEXT NOT NULL,
  is_game    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS game_norm_title ON game (norm_title);

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

// Columns added after the fact, so an existing library.db survives a schema
// change without being thrown away.
function addColumn(db, table, definition) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err;
  }
}

// ponytail: no migrations — the schema only grows by editing SCHEMA and deleting
// data/library.db. Fine while every row is re-syncable; needs a real migration
// once Xbox Entitlements (typed by hand, slice 7) live in here.
export function open(path = "data/library.db") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  addColumn(db, "entitlement", "confidence TEXT");
  addColumn(db, "entitlement", "alt_id TEXT");
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

export function credential(db, store) {
  const row = db.prepare("SELECT * FROM store_credential WHERE store = ?").get(store);
  return row ? { ...row, data: row.data ? JSON.parse(row.data) : null } : null;
}

export function saveCredential(db, store, data) {
  db.prepare(
    `INSERT INTO store_credential (store, data, status) VALUES (?, ?, 'connected')
       ON CONFLICT (store) DO UPDATE SET data = excluded.data, status = 'connected', last_error = NULL`,
  ).run(store, JSON.stringify(data));
}

export function stores(db) {
  return db.prepare("SELECT * FROM store_credential ORDER BY store").all();
}

// Only title-clustered Entitlements that actually got *merged* with another
// need review — a cluster of one merged nothing, so there is no wrong decision
// hiding in it and asking about it is pure busywork.
export function unmatched(db, afterId = 0) {
  return db
    .prepare(
      `SELECT e.id, e.store, e.store_title, g.title AS guess
         FROM entitlement e
         JOIN game g ON g.id = e.game_id
        WHERE e.locked = 0
          AND (e.confidence IS NULL OR e.confidence NOT IN ('igdb', 'igdb_name', 'manual'))
          AND e.id > ?
          AND (SELECT count(*) FROM entitlement o WHERE o.game_id = e.game_id) > 1
        ORDER BY e.id`,
    )
    .all(afterId);
}

export function gameTitles(db) {
  return db.prepare("SELECT title FROM game ORDER BY title COLLATE NOCASE").all().map((r) => r.title);
}
