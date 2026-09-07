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

// Each migration runs once, in order, tracked by SQLite's own user_version.
// Everything before this point was expressed as an idempotent bootstrap, which
// is migration 0. Xbox Entitlements are typed by hand and cannot be re-synced,
// so "delete the database and start again" is no longer an available answer.
const MIGRATIONS = [
  (db) => {
    db.exec(SCHEMA);
    addColumn(db, "entitlement", "confidence TEXT");
    addColumn(db, "entitlement", "alt_id TEXT");
    addColumn(db, "gfn_entry", "norm_title TEXT");
  },
  // Records which catalogue entry an Entitlement matched, so the discover page
  // can exclude what you own exactly rather than by guessing at titles again.
  (db) => addColumn(db, "entitlement", "gfn_title TEXT"),
  (db) => {
    addColumn(db, "game", "cover_url TEXT");
    addColumn(db, "game", "genres TEXT");
    addColumn(db, "gfn_entry", "image_url TEXT");
    addColumn(db, "gfn_entry", "genres TEXT");
  },
];

export function open(path = "data/library.db") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");

  const { user_version: from } = db.prepare("PRAGMA user_version").get();
  for (let v = from; v < MIGRATIONS.length; v++) MIGRATIONS[v](db);
  db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);

  return db;
}

// One row per Game, with the Stores it was bought in. Entitlements with no
// Game yet (unmatched) are deliberately absent — they live in the tray.
export function listGames(db, { q = "", store = "", gfn = false, all = false, genre = "" } = {}) {
  return db
    .prepare(
      `SELECT g.id,
              g.title,
              g.cover_url,
              g.genres,
              group_concat(e.store || ':' || coalesce(e.gfn_status, ''), ',') AS stores,
              max(e.gfn_status = 'AVAILABLE') AS streamable
         FROM game g
         JOIN entitlement e ON e.game_id = g.id
        WHERE (:all = 1 OR g.is_game = 1)
          AND (:q = '' OR g.title LIKE '%' || :q || '%')
          AND (:store = '' OR EXISTS (SELECT 1 FROM entitlement s WHERE s.game_id = g.id AND s.store = :store))
          AND (:genre = '' OR g.genres LIKE '%' || :genre || '%')
        GROUP BY g.id
       HAVING (:gfn = 0 OR streamable = 1)
        ORDER BY g.title COLLATE NOCASE`,
    )
    .all({ q, store, gfn: gfn ? 1 : 0, all: all ? 1 : 0, genre })
    .map((r) => ({
      ...r,
      streamable: !!r.streamable,
      // "steam:AVAILABLE" -> { store, status }: GFN support belongs to the
      // Entitlement, so each badge carries its own.
      stores: r.stores.split(",").map((s) => {
        const [store, status] = s.split(":");
        return { store, status: status || null };
      }),
    }));
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

// GeForce NOW games you do not own, and where you could buy them. The NVIDIA
// appid rows are excluded: they are a Steam-only supplement to the same
// catalogue and would double every Steam entry.
export function discoverGames(db, { q = "", store = "" } = {}, limit = 200) {
  return db
    .prepare(
      `SELECT min(title) AS title,
              max(image_url) AS cover_url,
              max(genres) AS genres,
              group_concat(DISTINCT store) AS stores
         FROM gfn_entry g
        WHERE g.steam_appid IS NULL
          AND g.store IS NOT NULL
          AND g.store NOT IN ('NONE', 'UNKNOWN')
          AND g.norm_title NOT IN (SELECT norm_title FROM game)
          AND g.norm_title NOT IN (SELECT gfn_title FROM entitlement WHERE gfn_title IS NOT NULL)
          AND (:q = '' OR g.title LIKE '%' || :q || '%')
          AND (:store = '' OR EXISTS (SELECT 1 FROM gfn_entry s WHERE s.norm_title = g.norm_title AND s.store = :store))
        GROUP BY g.norm_title
        ORDER BY min(title) COLLATE NOCASE
        LIMIT ${limit}`,
    )
    .all({ q, store })
    .map((r) => ({ ...r, stores: r.stores.split(",").sort() }));
}

export function discoverCount(db, filters = {}) {
  return discoverGames(db, filters, -1).length;
}

// A Store whose data is old enough to be misleading. GeForce NOW moves fastest
// — NVIDIA adds and drops titles weekly — so it goes stale soonest.
const STALE_DAYS = { gfn: 7 };
const DEFAULT_STALE_DAYS = 30;

export function staleSources(db, now = Date.now()) {
  return db
    .prepare("SELECT store, status, last_synced_at FROM store_credential WHERE store <> 'igdb'")
    .all()
    .map((row) => {
      const days = row.last_synced_at ? (now - Date.parse(row.last_synced_at)) / 86_400_000 : Infinity;
      return { ...row, days: Math.floor(days) };
    })
    .filter((row) => row.status === "needs_reauth" || row.days >= (STALE_DAYS[row.store] ?? DEFAULT_STALE_DAYS));
}

// Genres arrive as comma-separated lists; the filter needs them split out.
export function genreList(db) {
  const seen = new Set();
  for (const r of db.prepare("SELECT genres FROM game WHERE genres IS NOT NULL").all()) {
    for (const g of r.genres.split(",")) seen.add(g.trim());
  }
  return [...seen].filter(Boolean).sort();
}

export const hiddenCount = (db) =>
  db.prepare("SELECT count(*) c FROM game WHERE is_game = 0").get().c;

export const gameById = (db, id) => db.prepare("SELECT id, title FROM game WHERE id = ?").get(Number(id));

export const gameByTitle = (db, title) =>
  db.prepare("SELECT id, title FROM game WHERE title = ? ORDER BY id LIMIT 1").get(title);

export function gameTitles(db) {
  return db.prepare("SELECT title FROM game ORDER BY title COLLATE NOCASE").all().map((r) => r.title);
}
