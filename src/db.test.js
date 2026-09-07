import { test } from "node:test";
import assert from "node:assert/strict";
import { open, listGames } from "./db.js";

test("listGames groups Entitlements into one row per Game", () => {
  const db = open(":memory:");
  const now = "2026-01-01";
  db.exec(`
    INSERT INTO game (id, title) VALUES (1, 'Cyberpunk 2077'), (2, 'Hades'), (3, 'Some Soundtrack');
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
    games.map((g) => [g.title, g.stores.sort(), g.streamable]),
    [
      ["Cyberpunk 2077", ["epic", "gog"], true], // two Stores, one row; GFN from either
      ["Hades", ["steam"], false],
    ],
  ); // non-game hidden, unmatched Entitlement absent
});
