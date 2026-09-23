import { test } from "node:test";
import assert from "node:assert/strict";
import { open, listGames, discoverGames, studioList, staleSources, replaceAll } from "./db.js";

test("listGames groups Entitlements into one row per Game", () => {
  const db = open(":memory:");
  const now = "2026-01-01";
  db.exec(`
    INSERT INTO game (id, title, norm_title) VALUES
      (1, 'Cyberpunk 2077', 'cyberpunk 2077'), (2, 'Hades', 'hades'), (3, 'Some Soundtrack', 'some soundtrack');
    UPDATE game SET is_game = 0 WHERE id = 3;
    INSERT INTO entitlement (store, store_game_id, store_title, game_id, first_seen, last_seen, gfn_status) VALUES
      ('gog',   '123', 'Cyberpunk 2077', 1, '${now}', '${now}', 'AVAILABLE'),
      ('epic',  'abc', 'Cyberpunk 2077', 1, '${now}', '${now}', NULL),
      ('steam', '999', 'Hades',          2, '${now}', '${now}', NULL),
      ('steam', '777', 'Some Soundtrack',3, '${now}', '${now}', NULL),
      ('steam', '888', 'Unmatched Thing', NULL, '${now}', '${now}', NULL);
  `);

  const games = listGames(db);
  assert.deepEqual(
    games.map((g) => [g.title, g.stores.map((s) => `${s.store}:${s.status ?? ""}`).sort(), g.streamable]),
    [
      // two Stores, one row; the badge is per Entitlement, the flag per Game
      ["Cyberpunk 2077", ["epic:", "gog:AVAILABLE"], true],
      ["Hades", ["steam:"], false],
    ],
  ); // non-game hidden, unmatched Entitlement absent
});

test("staleness: GeForce NOW goes stale in a week, stores in a month", () => {
  const db = open(":memory:");
  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
  db.exec(`
    INSERT INTO store_credential (store, status, last_synced_at) VALUES
      ('gfn',   'connected', '${daysAgo(8)}'),
      ('steam', 'connected', '${daysAgo(8)}'),
      ('gog',   'connected', '${daysAgo(31)}'),
      ('epic',  'needs_reauth', '${daysAgo(1)}'),
      ('igdb',  'connected', NULL);
  `);

  assert.deepEqual(
    staleSources(db).map((s) => s.store).sort(),
    ["epic", "gfn", "gog"],
    "GFN at 8 days but Steam not; GOG at 31; Epic because it needs reconnecting, however recent",
  );
});

test("a source that has never synced counts as stale", () => {
  const db = open(":memory:");
  db.exec("INSERT INTO store_credential (store, status) VALUES ('gfn', 'connected')");
  assert.deepEqual(staleSources(db).map((s) => s.store), ["gfn"]);
});

// Every catalogue sweep deletes its table and rebuilds it. Half a rebuild is
// worse than no rebuild: Discover would lose every price, score and badge.
test("a sweep that dies halfway leaves the table it was replacing untouched", () => {
  const db = open(":memory:");
  db.exec("INSERT INTO steam_app (norm_title, appid) VALUES ('portal 2', '620')");

  assert.throws(() =>
    replaceAll(db, () => {
      db.exec("DELETE FROM steam_app");
      db.exec("INSERT INTO steam_app (norm_title, appid) VALUES ('half life', '70')");
      throw new Error("Steam app list returned 500");
    }),
  );

  assert.deepEqual(
    db.prepare("SELECT norm_title, appid FROM steam_app").all().map((r) => [r.norm_title, r.appid]),
    [["portal 2", "620"]],
  );
  // ...and the connection is usable afterwards, not stuck in a transaction.
  replaceAll(db, () => db.exec("DELETE FROM steam_app"));
  assert.equal(db.prepare("SELECT count(*) c FROM steam_app").get().c, 0);
});

test("the studio filter matches a whole name on both Library and Discover", () => {
  const db = open(":memory:");
  const now = "2026-01-01";
  db.exec(`
    INSERT INTO game (id, title, norm_title, studio) VALUES
      (1, 'Hades', 'hades', 'Supergiant Games'), (2, 'Bastion', 'bastion', 'Supergiant Games'),
      (3, 'Portal 2', 'portal 2', 'Valve');
    INSERT INTO entitlement (store, store_game_id, store_title, game_id, first_seen, last_seen) VALUES
      ('steam', '1', 'Hades', 1, '${now}', '${now}'),
      ('steam', '2', 'Bastion', 2, '${now}', '${now}'),
      ('steam', '3', 'Portal 2', 3, '${now}', '${now}');
    INSERT INTO gfn_entry (title, norm_title, store, status, publisher) VALUES
      ('Hades II', 'hades ii', 'STEAM', 'AVAILABLE', 'Supergiant Games'),
      ('Half-Life 2', 'half life 2', 'STEAM', 'AVAILABLE', 'Valve');
  `);

  assert.deepEqual(listGames(db, { studio: "Supergiant Games" }).map((g) => g.title), ["Bastion", "Hades"]);
  // A partial name is not a match: the datalist supplies whole names, and
  // "Valve" must not also pull in "Valve Software".
  assert.deepEqual(listGames(db, { studio: "Supergiant" }).map((g) => g.title), []);
  assert.deepEqual(studioList(db), ["Supergiant Games", "Valve"]);

  const found = discoverGames(db, { studio: "Supergiant Games" });
  assert.deepEqual(found.map((g) => [g.title, g.studio]), [["Hades II", "Supergiant Games"]]);
  assert.deepEqual(studioList(db, "gfn_entry"), ["Supergiant Games", "Valve"]);
});
