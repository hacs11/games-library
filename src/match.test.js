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
