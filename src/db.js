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
  (db) => {
    addColumn(db, "game", "rating INTEGER");
    addColumn(db, "game", "rating_source TEXT");
    addColumn(db, "game", "rating_url TEXT");
    // Steam scores are fetched one appid at a time and rate limited, so what
    // has been asked is remembered — including the misses, which are permanent.
    db.exec(`CREATE TABLE IF NOT EXISTS steam_rating (
      appid      TEXT PRIMARY KEY,
      score      INTEGER,
      url        TEXT,
      fetched_at TEXT NOT NULL
    )`);
  },
  (db) => {
    addColumn(db, "game", "year INTEGER");
    addColumn(db, "entitlement", "playtime_minutes INTEGER");
  },
  // Catalogue prices. Kept out of gfn_entry, which is replaced wholesale on
  // every GeForce NOW sync — appid resolution and prices should outlive that.
  (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS steam_app (
      norm_title TEXT PRIMARY KEY,
      appid      TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS steam_price (
      appid            TEXT PRIMARY KEY,
      currency         TEXT,
      final_cents      INTEGER,
      initial_cents    INTEGER,
      discount_percent INTEGER,
      formatted        TEXT,
      fetched_at       TEXT NOT NULL
    )`);
  },
  // A second Store sells the same catalogue, so prices stop being Steam's.
  // GOG's own ids are its product ids; Steam's are appids, and the pair
  // (store, id) is what a price actually belongs to.
  (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS gog_app (
      norm_title TEXT PRIMARY KEY,
      product_id TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS catalogue_price (
      store            TEXT NOT NULL,
      store_id         TEXT NOT NULL,
      currency         TEXT,
      final_cents      INTEGER,
      initial_cents    INTEGER,
      discount_percent INTEGER,
      formatted        TEXT,
      fetched_at       TEXT NOT NULL,
      PRIMARY KEY (store, store_id)
    )`);
    db.exec(`INSERT OR REPLACE INTO catalogue_price
               SELECT 'steam', appid, currency, final_cents, initial_cents,
                      discount_percent, formatted, fetched_at FROM steam_price`);
    db.exec("DROP TABLE steam_price");
  },
  // Starred discover titles. Keyed by norm_title like the rest of Discover:
  // these are catalogue entries with no Game row behind them.
  (db) =>
    db.exec(`CREATE TABLE IF NOT EXISTS watchlist (
      norm_title TEXT PRIMARY KEY,
      added_at   TEXT NOT NULL
    )`),
  // A third catalogue. Xbox ids are Store product ids ("9P6HVHDP2PGK"), and
  // only Play Anywhere titles are in it — the same rule the Entitlements follow.
  (db) =>
    db.exec(`CREATE TABLE IF NOT EXISTS xbox_app (
      norm_title TEXT PRIMARY KEY,
      product_id TEXT NOT NULL
    )`),
  // Who made it. IGDB names the developer for an identified Game; the GeForce
  // NOW catalogue only ever names a publisher, which is all Discover can show.
  (db) => {
    addColumn(db, "game", "studio TEXT");
    addColumn(db, "gfn_entry", "publisher TEXT");
  },
  // Market Lows. Keyed by Steam appid rather than (store, store_id) because
  // gg.deals' free tier names no store — which is exactly why these cannot go
  // in catalogue_price and cannot be Store prices (docs/adr/0006).
  (db) =>
    db.exec(`CREATE TABLE IF NOT EXISTS market_low (
      appid             TEXT PRIMARY KEY,
      currency          TEXT,
      retail_cents      INTEGER,
      keyshop_cents     INTEGER,
      retail_low_cents  INTEGER,
      keyshop_low_cents INTEGER,
      title             TEXT,
      url               TEXT,
      fetched_at        TEXT NOT NULL
    )`),
  // Steam hands the release date back in the same request as the score, so the
  // year costs nothing extra to collect. `year_at` is the "asked" marker the
  // score gets for free by having a row at all: every appid already memoised
  // predates the year, so it re-enters the sweep exactly once, and an appid
  // Steam gives no date for is stamped and never asked again.
  (db) => {
    addColumn(db, "steam_rating", "year INTEGER");
    addColumn(db, "steam_rating", "year_at TEXT");
  },
];

export function open(path = "data/library.db") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  // Long writes (pricing the catalogue, fetching Metacritic) run for minutes
  // while pages are being served. WAL lets readers work through a write, and
  // without a busy timeout a second connection fails instantly instead of
  // waiting its turn.
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 10000");

  const { user_version: from } = db.prepare("PRAGMA user_version").get();
  for (let v = from; v < MIGRATIONS.length; v++) MIGRATIONS[v](db);
  db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);

  return db;
}

// One row per Game, with the Stores it was bought in. Entitlements with no
// Game yet (unmatched) are deliberately absent — they live in the tray.
const SORTS = {
  rating: "g.rating IS NULL, g.rating DESC,",
  year: "g.year IS NULL, g.year DESC,",
};

// Rendering 614 covers inline makes a 560KB page on every navigation, so the
// grid is capped and the count says so; ?limit=0 renders everything.
export function listGames(db, { q = "", store = "", gfn = false, all = false, genre = "", studio = "", sort = "", minScore = 0 } = {}, limit = 240) {
  return db
    .prepare(
      `SELECT g.id,
              g.title,
              g.cover_url,
              g.genres,
              g.studio,
              g.rating,
              g.rating_source,
              g.rating_url,
              g.year,
              (SELECT sum(playtime_minutes) FROM entitlement p WHERE p.game_id = g.id) AS playtime_minutes,
              group_concat(e.store || ':' || coalesce(e.gfn_status, ''), ',') AS stores,
              max(e.gfn_status = 'AVAILABLE') AS streamable
         FROM game g
         JOIN entitlement e ON e.game_id = g.id
        WHERE (:all = 1 OR g.is_game = 1)
          AND (:q = '' OR g.title LIKE '%' || :q || '%')
          AND (:store = '' OR EXISTS (SELECT 1 FROM entitlement s WHERE s.game_id = g.id AND s.store = :store))
          AND (:genre = '' OR g.genres LIKE '%' || :genre || '%')
          AND (:studio = '' OR g.studio = :studio)
          AND (:minScore = 0 OR g.rating >= :minScore)
        GROUP BY g.id
       HAVING (:gfn = 0 OR streamable = 1)
        ORDER BY ${SORTS[sort] ?? ""} g.title COLLATE NOCASE
        ${limit > 0 ? `LIMIT ${Number(limit)}` : ""}`,
    )
    .all({ q, store, gfn: gfn ? 1 : 0, all: all ? 1 : 0, genre, studio, minScore: Number(minScore) || 0 })
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

// A sweep that replaces a table wholesale must not be visible half-done. The
// fetch is already collected in memory first, but the DELETE and the inserts
// that follow it are separate statements: a page rendered between them sees an
// empty catalogue and loses every price, score and badge it had. One
// transaction makes the swap atomic to anyone reading through it. IMMEDIATE
// takes the write lock up front rather than discovering it mid-sweep.
export function replaceAll(db, write) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = write();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
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

// Cheapest and biggest-saving sorts put the unpriced titles last: a title with
// no price is not a bargain, it is an unknown.
const DISCOVER_SORTS = {
  discount: "best_discount DESC,",
  rating: "rating IS NULL, rating DESC,",
  price: "best_price IS NULL, best_price,",
  saving: "best_saving DESC,",
};

// GeForce NOW games you do not own, and where you could buy them. The NVIDIA
// appid rows are excluded: they are a Steam-only supplement to the same
// catalogue and would double every Steam entry.
export function discoverGames(db, { q = "", store = "", sale = false, low = false, watch = false, sort = "", genre = "", studio = "", minScore = 0 } = {}, limit = 200) {
  return db
    .prepare(
      `SELECT g.norm_title,
              min(g.title) AS title,
              max(g.image_url) AS cover_url,
              max(g.genres) AS genres,
              max(g.publisher) AS studio,
              group_concat(DISTINCT g.store) AS stores,
              EXISTS (SELECT 1 FROM watchlist w WHERE w.norm_title = g.norm_title) AS watched,
              ${PRICE_COLUMNS},
              ${RATING_COLUMNS},
              ${AT_RETAIL_LOW}
         FROM gfn_entry g
         ${PRICE_JOINS}
         ${RATING_JOIN}
         ${MARKET_JOIN}
        WHERE g.steam_appid IS NULL
          AND g.store IS NOT NULL
          AND g.store NOT IN ('NONE', 'UNKNOWN')
          AND g.norm_title NOT IN (SELECT norm_title FROM game)
          AND g.norm_title NOT IN (SELECT gfn_title FROM entitlement WHERE gfn_title IS NOT NULL)
          AND (:q = '' OR g.title LIKE '%' || :q || '%')
          AND (:store = '' OR EXISTS (SELECT 1 FROM gfn_entry s WHERE s.norm_title = g.norm_title AND s.store = :store))
          AND (:watch = 0 OR g.norm_title IN (SELECT norm_title FROM watchlist))
          AND (:genre = '' OR EXISTS (SELECT 1 FROM gfn_entry n WHERE n.norm_title = g.norm_title AND n.genres LIKE '%' || :genre || '%'))
          AND (:studio = '' OR EXISTS (SELECT 1 FROM gfn_entry u WHERE u.norm_title = g.norm_title AND u.publisher = :studio))
        GROUP BY g.norm_title
       HAVING (:sale = 0 OR best_discount > 0)
          AND (:low = 0 OR at_retail_low)
          AND (:minScore = 0 OR rating >= :minScore)
        ORDER BY ${DISCOVER_SORTS[sort] ?? ""} min(g.title) COLLATE NOCASE
        ${limit > 0 ? `LIMIT ${limit}` : ""}`,
    )
    .all({ q, store, sale: sale ? 1 : 0, low: low ? 1 : 0, watch: watch ? 1 : 0, genre, studio, minScore: Number(minScore) || 0 })
    .map(withPrices);
}

// A price is only shown for a Store that GeForce NOW actually lists this title
// under. Support is per-Entitlement (docs/adr/0003): buying it on GOG when only
// the Steam variant streams would be a purchase that does not stream, so the
// cheaper price of a Store you cannot stream from is worse than no price.

// With a Store filter on, the deal signals must answer the question the filter
// asks: "on sale" and the deal sorts mean on sale at *that* Store. A Steam
// discount surfacing under an Xbox filter is a sale you cannot take — the same
// mistake sells() prevents across GeForce NOW, one level in.
const picked = (catalogueStore, col) => `CASE WHEN :store IN ('', '${catalogueStore}') THEN ${col} END`;

// sp/gp join on norm_title, so their columns are identical across every row of
// a group — a bare aggregate over them picks the one value there is.
const PRICE_COLUMNS = `max(sp.formatted) AS steam_price,
              max(sp.discount_percent) AS steam_discount,
              max(gp.formatted) AS gog_price,
              max(gp.discount_percent) AS gog_discount,
              max(xp.formatted) AS xbox_price,
              max(xp.discount_percent) AS xbox_discount,
              max(coalesce(${picked("STEAM", "sp.discount_percent")}, 0), coalesce(${picked("GOG", "gp.discount_percent")}, 0),
                  coalesce(${picked("XBOX", "xp.discount_percent")}, 0)) AS best_discount,
              nullif(min(coalesce(${picked("STEAM", "sp.final_cents")}, 1e15), coalesce(${picked("GOG", "gp.final_cents")}, 1e15),
                         coalesce(${picked("XBOX", "xp.final_cents")}, 1e15)), 1e15) AS best_price,
              max(coalesce(${picked("STEAM", "sp.initial_cents - sp.final_cents")}, 0), coalesce(${picked("GOG", "gp.initial_cents - gp.final_cents")}, 0),
                  coalesce(${picked("XBOX", "xp.initial_cents - xp.final_cents")}, 0)) AS best_saving`;

// The `sells` clause is what keeps a price tied to a Store you could actually
// stream from. Without it a GOG sale leaks into best_discount and badges a
// Steam-only title "-95%" next to Steam's full price.
const sells = (catalogueStore) =>
  `EXISTS (SELECT 1 FROM gfn_entry v WHERE v.norm_title = g.norm_title AND v.store = '${catalogueStore}')`;

const PRICE_JOINS = `LEFT JOIN steam_app a ON a.norm_title = g.norm_title AND ${sells("STEAM")}
         LEFT JOIN catalogue_price sp ON sp.store = 'steam' AND sp.store_id = a.appid
         LEFT JOIN gog_app ga ON ga.norm_title = g.norm_title AND ${sells("GOG")}
         LEFT JOIN catalogue_price gp ON gp.store = 'gog' AND gp.store_id = ga.product_id
         LEFT JOIN xbox_app xa ON xa.norm_title = g.norm_title AND ${sells("XBOX")}
         LEFT JOIN catalogue_price xp ON xp.store = 'xbox' AND xp.store_id = xa.product_id`;

// Metacritic's score for the Steam listing, reused for the catalogue. Unlike a
// price this is NOT gated by sells(): a review score is a property of the Game,
// not of the Store you would buy it from, so the Steam score stands even for a
// title GeForce NOW lists under GOG alone. Contrast PRICE_JOINS above.
const RATING_COLUMNS = `max(r.score) AS rating,
              max(r.url) AS rating_url,
              max(r.year) AS year`;

const RATING_JOIN = `LEFT JOIN steam_app ra ON ra.norm_title = g.norm_title
         LEFT JOIN steam_rating r ON r.appid = ra.appid`;

// The Market Low: cheapest anywhere and its all-time low, from gg.deals. Like
// the rating and unlike the prices above it is NOT gated by sells(), because it
// names no Store — and for the same reason it must never be badged as a
// discount on a store row or folded into best_discount (docs/adr/0006). The
// appid comes from the title→appid table, or from GeForce NOW's own NVIDIA rows
// for a title the resolver dropped as ambiguous.
const MARKET_COLUMNS = `max(ml.retail_cents) AS market_retail,
              max(ml.keyshop_cents) AS market_keyshop,
              max(ml.retail_low_cents) AS market_retail_low,
              max(ml.keyshop_low_cents) AS market_keyshop_low,
              max(ml.currency) AS market_currency,
              max(ml.url) AS market_url`;

// The one thing about a Market Low the grid may carry: whether the retail
// cheapest-anywhere is sitting at its all-time low. A boolean, not a figure —
// the grid has nowhere to put gg.deals' attribution link, and the panel does.
// gg.deals reports the current price *as* the historical low when the current
// price is the low, so equality is the signal. Retail only: a keyshop is a
// reseller of keys, its low is noisier, and it is not a Store price at all
// (docs/adr/0006).
//
// A title this app can price nowhere is not marked, however low gg.deals says
// the market is: there is no price on the tile for the mark to be a claim
// about, and nothing to buy at it. The test is any store price, not the
// filtered `best_price` — the store filter must not decide whether a storeless
// figure counts.
const AT_RETAIL_LOW = `(max(ml.retail_cents) IS NOT NULL
                AND max(ml.retail_cents) <= max(ml.retail_low_cents)
                AND coalesce(max(sp.formatted), max(gp.formatted), max(xp.formatted)) IS NOT NULL) AS at_retail_low`;

const MARKET_JOIN = `LEFT JOIN steam_app ma ON ma.norm_title = g.norm_title
         LEFT JOIN gfn_entry mn ON mn.norm_title = g.norm_title AND mn.steam_appid IS NOT NULL
         LEFT JOIN market_low ml ON ml.appid = coalesce(ma.appid, mn.steam_appid)`;

function withPrices(r) {
  const prices = [
    { store: "steam", formatted: r.steam_price, discount: r.steam_discount },
    { store: "gog", formatted: r.gog_price, discount: r.gog_discount },
    { store: "xbox", formatted: r.xbox_price, discount: r.xbox_discount },
  ].filter((p) => p.formatted);
  return {
    ...r,
    stores: r.stores.split(",").sort(),
    prices,
    // Deliberately its own field and not a member of `prices`: nothing that
    // renders a store row may reach it (docs/adr/0006).
    market:
      r.market_retail != null || r.market_keyshop != null
        ? {
            retail: r.market_retail,
            keyshop: r.market_keyshop,
            retail_low: r.market_retail_low,
            keyshop_low: r.market_keyshop_low,
            currency: r.market_currency,
            url: r.market_url,
          }
        : null,
    at_retail_low: !!r.at_retail_low,
    best_discount: r.best_discount || null,
    watched: !!r.watched,
  };
}

// Starring is a toggle: the same button both adds and removes.
export function toggleWatch(db, normTitle) {
  const { changes } = db.prepare("DELETE FROM watchlist WHERE norm_title = ?").run(String(normTitle));
  if (changes === 0) {
    db.prepare("INSERT INTO watchlist (norm_title, added_at) VALUES (?, ?)")
      .run(String(normTitle), new Date().toISOString());
  }
  return changes === 0;
}

export const watchCount = (db) => db.prepare("SELECT count(*) c FROM watchlist").get().c;

export function discoverCount(db, filters = {}) {
  return discoverGames(db, filters, 0).length;
}

// Prices and scores are not a Store with a Connection, so nothing was ever
// written to store_credential for them and the card said "never synced" no
// matter how recently it ran. Their own rows carry when they were fetched.
export const priceCounts = (db) => ({
  fetched: db.prepare("SELECT max(fetched_at) t FROM catalogue_price").get().t,
  apps: db.prepare("SELECT count(*) c FROM steam_app").get().c,
  products: db.prepare("SELECT count(*) c FROM gog_app").get().c,
  titles: db.prepare("SELECT count(*) c FROM xbox_app").get().c,
  market: {
    fetched: db.prepare("SELECT max(fetched_at) t FROM market_low").get().t,
    priced: db.prepare("SELECT count(*) c FROM market_low WHERE retail_cents IS NOT NULL OR keyshop_cents IS NOT NULL").get().c,
    asked: db.prepare("SELECT count(*) c FROM market_low").get().c,
  },
  ...Object.fromEntries(
    ["steam", "gog", "xbox"].map((store) => [
      store,
      {
        priced: db.prepare("SELECT count(*) c FROM catalogue_price WHERE store = ? AND final_cents IS NOT NULL").get(store).c,
        onSale: db.prepare("SELECT count(*) c FROM catalogue_price WHERE store = ? AND discount_percent > 0").get(store).c,
      },
    ]),
  ),
});

// One catalogue title for the Discover panel, keyed by the normalised title
// the rows are grouped on — Discover has no Game row to hang an id off.
export function discoverDetail(db, normTitle) {
  const row = db
    .prepare(
      `SELECT g.norm_title,
              min(g.title) AS title,
              max(g.image_url) AS cover_url,
              max(g.genres) AS genres,
              max(g.publisher) AS studio,
              group_concat(DISTINCT g.store) AS stores,
              EXISTS (SELECT 1 FROM watchlist w WHERE w.norm_title = g.norm_title) AS watched,
              ${PRICE_COLUMNS},
              ${RATING_COLUMNS},
              ${MARKET_COLUMNS},
              ${AT_RETAIL_LOW}
         FROM gfn_entry g
         ${PRICE_JOINS}
         ${RATING_JOIN}
         ${MARKET_JOIN}
        WHERE g.norm_title = :title
        GROUP BY g.norm_title`,
    )
    .get({ title: String(normTitle), store: "" });
  return row ? withPrices(row) : null;
}

// A Store whose data is old enough to be misleading. GeForce NOW moves fastest
// — NVIDIA adds and drops titles weekly — so it goes stale soonest.
const STALE_DAYS = { gfn: 7 };
const DEFAULT_STALE_DAYS = 30;

export function staleSources(db, now = Date.now()) {
  return db
    // igdb and ggdeals are credentials for services, not Stores with a Sync:
    // nothing ever stamps last_synced_at on them, so they are never stale.
    .prepare("SELECT store, status, last_synced_at FROM store_credential WHERE store NOT IN ('igdb', 'ggdeals')")
    .all()
    .map((row) => {
      const days = row.last_synced_at ? (now - Date.parse(row.last_synced_at)) / 86_400_000 : Infinity;
      return { ...row, days: Math.floor(days) };
    })
    .filter((row) => row.status === "needs_reauth" || row.days >= (STALE_DAYS[row.store] ?? DEFAULT_STALE_DAYS));
}

// Genres arrive as comma-separated lists; the filter needs them split out.
export function genreList(db, table = "game") {
  const seen = new Set();
  for (const r of db.prepare(`SELECT genres FROM ${table === "gfn_entry" ? "gfn_entry" : "game"} WHERE genres IS NOT NULL`).all()) {
    for (const g of r.genres.split(",")) seen.add(g.trim());
  }
  return [...seen].filter(Boolean).sort();
}

// Studios are single values, unlike the comma-separated genres above.
export function studioList(db, table = "game") {
  const column = table === "gfn_entry" ? "publisher" : "studio";
  return db
    .prepare(`SELECT DISTINCT ${column} AS s FROM ${table === "gfn_entry" ? "gfn_entry" : "game"} WHERE ${column} IS NOT NULL AND ${column} <> '' ORDER BY s COLLATE NOCASE`)
    .all()
    .map((r) => r.s);
}

export const ratingCounts = (db) => ({
  fetched: db.prepare("SELECT max(fetched_at) t FROM steam_rating").get().t,
  metacritic: db.prepare("SELECT count(*) c FROM game WHERE rating_source = 'metacritic'").get().c,
  igdb: db.prepare("SELECT count(*) c FROM game WHERE rating_source LIKE 'igdb:%'").get().c,
});

export const hiddenCount = (db) =>
  db.prepare("SELECT count(*) c FROM game WHERE is_game = 0").get().c;

export const gameById = (db, id) => db.prepare("SELECT id, title FROM game WHERE id = ?").get(Number(id));

export const gameByTitle = (db, title) =>
  db.prepare("SELECT id, title FROM game WHERE title = ? ORDER BY id LIMIT 1").get(title);

export function gameTitles(db) {
  return db.prepare("SELECT title FROM game ORDER BY title COLLATE NOCASE").all().map((r) => r.title);
}

export function countGames(db, filters = {}) {
  return listGames(db, filters, 0).length;
}

export const ownedCount = (db) =>
  db.prepare("SELECT count(*) c FROM game WHERE is_game = 1 AND EXISTS (SELECT 1 FROM entitlement e WHERE e.game_id = game.id)").get().c;

// Everything the detail panel shows about one Game, including per-Store rows.
export function gameDetail(db, id) {
  const game = db
    .prepare(
      `SELECT g.*, (SELECT sum(playtime_minutes) FROM entitlement p WHERE p.game_id = g.id) AS playtime_minutes
         FROM game g WHERE g.id = ?`,
    )
    .get(Number(id));
  if (!game) return null;

  game.entitlements = db
    .prepare(
      `SELECT store, store_game_id, store_title, gfn_status, playtime_minutes
         FROM entitlement WHERE game_id = ? ORDER BY store`,
    )
    .all(Number(id));
  return game;
}
