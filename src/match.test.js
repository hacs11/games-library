import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential, unmatched } from "./db.js";
import { matchEntitlements } from "./match.js";
import { syncStore } from "./sync.js";

const seeded = async (store, ...titles) => {
  const db = open(":memory:");
  saveCredential(db, store, { api_key: "k", steam_id: "1" });
  await syncStore(db, store, async () =>
    titles.map((t, i) => ({ store_game_id: `${store}-${i}`, store_title: t })),
  );
  return db;
};

test("IGDB collapses differently-titled Entitlements into one Game", async () => {
  const db = await seeded("steam", "Cyberpunk 2077");
  saveCredential(db, "gog", { token: "x" });
  await syncStore(db, "gog", async () => [
    { store_game_id: "g1", store_title: "Cyberpunk 2077: Ultimate Edition" },
  ]);

  const identify = async (_db, store) =>
    new Map([[`${store === "steam" ? "steam-0" : "g1"}`, { igdb_id: 1877, title: "Cyberpunk 2077" }]]);
  await matchEntitlements(db, "steam", identify);
  await matchEntitlements(db, "gog", identify);

  const rows = db
    .prepare("SELECT DISTINCT game_id FROM entitlement")
    .all();
  assert.equal(rows.length, 1, "both Stores point at the same Game");
  assert.equal(db.prepare("SELECT count(*) c FROM game WHERE igdb_id = 1877").get().c, 1);
  assert.equal(unmatched(db).length, 0, "IGDB matches need no review");
});

test("a fallback that merged nothing is not worth reviewing", async () => {
  const db = await seeded("steam", "Some Obscure Bundle", "Hades");
  await matchEntitlements(db, "steam", async () => new Map([["steam-1", { igdb_id: 7, title: "Hades" }]]));

  assert.equal(db.prepare("SELECT confidence FROM entitlement WHERE store_game_id = 'steam-0'").get().confidence, "title");
  assert.equal(unmatched(db).length, 0, "a title cluster of one merged nothing, so there is no decision to make");
});

test("a fallback that actually merged two Entitlements does need reviewing", async () => {
  const db = await seeded("steam", "Weird Edition");
  saveCredential(db, "gog", { token: "x" });
  await syncStore(db, "gog", async () => [{ store_game_id: "g1", store_title: "weird edition" }]);
  await matchEntitlements(db, "steam", async () => new Map());
  await matchEntitlements(db, "gog", async () => new Map());

  const tray = unmatched(db);
  assert.equal(tray.length, 2, "both sides of a title-only merge are offered for review");
});

test("IGDB being down degrades to title matching instead of failing the Sync", async () => {
  const db = await seeded("steam", "Hades");
  const boom = async () => {
    throw new Error("IGDB 503");
  };
  await matchEntitlements(db, "steam", boom);

  const row = db.prepare("SELECT game_id, confidence FROM entitlement").get();
  assert.ok(row.game_id, "the Entitlement still has a Game");
  assert.equal(row.confidence, "title");
});

test("a confirmed Entitlement leaves the tray for good", async () => {
  const db = await seeded("steam", "Weird Title");
  saveCredential(db, "gog", { token: "x" });
  await syncStore(db, "gog", async () => [{ store_game_id: "g1", store_title: "WEIRD TITLE" }]);
  await matchEntitlements(db, "steam", async () => new Map());
  await matchEntitlements(db, "gog", async () => new Map());
  assert.equal(unmatched(db).length, 2);

  db.prepare("UPDATE entitlement SET locked = 1, confidence = 'manual'").run();
  assert.equal(unmatched(db).length, 0);

  await matchEntitlements(db, "steam", async () => new Map());
  assert.equal(unmatched(db).length, 0, "a later Sync does not reopen it");
});

test("matching leaves no Games behind that hold no Entitlements", async () => {
  const db = await seeded("steam", "Half-Life 2", "Portal");
  // First pass falls back to titles, second identifies them: the title Games
  // created by the first pass must not survive as phantoms in the autocomplete.
  await matchEntitlements(db, "steam", async () => new Map());
  await matchEntitlements(db, "steam", async () =>
    new Map([
      ["steam-0", { igdb_id: 233, title: "Half-Life 2" }],
      ["steam-1", { igdb_id: 358, title: "Portal" }],
    ]),
  );

  assert.equal(db.prepare("SELECT count(*) c FROM game").get().c, 2);
  assert.equal(
    db.prepare("SELECT count(*) c FROM game WHERE id NOT IN (SELECT game_id FROM entitlement WHERE game_id IS NOT NULL)").get().c,
    0,
  );
});

test("a Store IGDB does not index by id is matched by its IGDB title instead", async () => {
  const db = await seeded("steam", "Hades");
  saveCredential(db, "epic", { token: "x" });
  await syncStore(db, "epic", async () => [{ store_game_id: "cat", alt_id: "ns", store_title: "HADES" }]);

  await matchEntitlements(db, "steam", async () => new Map([["steam-0", { igdb_id: 7, title: "Hades" }]]));
  const result = await matchEntitlements(
    db,
    "epic",
    async () => new Map(), // neither Epic id is known to IGDB
    async () => new Map([["hades", { igdb_id: 7, title: "Hades" }]]),
  );

  assert.deepEqual([result.igdb, result.named], [0, 1]);
  assert.equal(db.prepare("SELECT count(DISTINCT game_id) c FROM entitlement").get().c, 1,
    "the Epic Entitlement lands on the same Game as Steam");
  assert.equal(unmatched(db).length, 0);
});

test("an ambiguous title is left to clustering rather than guessed at", async () => {
  const db = open(":memory:");
  saveCredential(db, "epic", { token: "x" });
  await syncStore(db, "epic", async () => [{ store_game_id: "c1", store_title: "Make Way" }]);

  // Two IGDB games share the name, so identifyByName returns nothing for it.
  const result = await matchEntitlements(db, "epic", async () => new Map(), async () => new Map());
  assert.deepEqual([result.named, result.fallback], [0, 1]);
  assert.equal(db.prepare("SELECT confidence FROM entitlement").get().confidence, "title");
});

test("merging moves a Game's Entitlements and locks the decision", async () => {
  const db = await seeded("steam", "Agony");
  saveCredential(db, "epic", { t: 1 });
  await syncStore(db, "epic", async () => [{ store_game_id: "e1", store_title: "Agony UNRATED" }]);
  await matchEntitlements(db, "steam", async () => new Map(), async () => new Map());
  await matchEntitlements(db, "epic", async () => new Map(), async () => new Map());

  const [a, b] = db.prepare("SELECT id, title FROM game ORDER BY title").all();
  assert.equal(db.prepare("SELECT count(*) c FROM game").get().c, 2);

  const { mergeGames } = await import("./match.js");
  assert.equal(mergeGames(db, b.id, a.id), true);

  assert.equal(db.prepare("SELECT count(*) c FROM game").get().c, 1, "the merged-away Game is gone");
  assert.equal(db.prepare("SELECT count(DISTINCT game_id) c FROM entitlement").get().c, 1);
  assert.deepEqual(
    // spread: node:sqlite rows have a null prototype, which deepStrictEqual rejects
    db.prepare("SELECT DISTINCT locked, confidence FROM entitlement WHERE game_id = ?").all(a.id).map((r) => ({ ...r })),
    [{ locked: 1, confidence: "manual" }],
    "both sides of the merge are locked, not just the Entitlements that moved",
  );

  // The point of locking: matching must not undo a decision you made by hand.
  await matchEntitlements(db, "epic", async () => new Map(), async () => new Map());
  assert.equal(db.prepare("SELECT count(*) c FROM game").get().c, 1, "a later Sync does not split them");
});

test("merging refuses nonsense rather than corrupting the library", async () => {
  const db = await seeded("steam", "Agony");
  const { mergeGames } = await import("./match.js");
  const game = db.prepare("SELECT id FROM game").get();
  assert.equal(mergeGames(db, game.id, game.id), false, "a game cannot merge into itself");
  assert.equal(mergeGames(db, game.id, 99999), false, "nor into one that does not exist");
  assert.equal(db.prepare("SELECT count(*) c FROM entitlement WHERE game_id IS NOT NULL").get().c, 1);
});
