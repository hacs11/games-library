import { test } from "node:test";
import assert from "node:assert/strict";
import { open, listGames, staleSources } from "./db.js";

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
