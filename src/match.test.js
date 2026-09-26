import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential, unmatched, listGames } from "./db.js";
import { addEditions, matchEntitlements } from "./match.js";
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

test("store junk is hidden, and never merges into the game it is named after", async () => {
  const db = await seeded(
    "steam",
    "Football Manager 2024",
    "Football Manager 2024 Pre-game editor",
    "Football Manager 2024 Resource archiver",
    "The Last Caretaker Demo",
    "Hades",
  );
  const { classifyGames } = await import("./match.js");

  // IGDB would happily name-match the editor onto the real game.
  await matchEntitlements(
    db,
    "steam",
    async () => new Map(),
    async () =>
      new Map([
        ["football manager 2024", { igdb_id: 1, title: "Football Manager 2024" }],
        ["football manager 2024 pre game editor", { igdb_id: 1, title: "Football Manager 2024" }],
        ["football manager 2024 resource archiver", { igdb_id: 1, title: "Football Manager 2024" }],
        ["hades", { igdb_id: 2, title: "Hades" }],
      ]),
  );
  await classifyGames(db, async () => new Map([[1, 0], [2, 0]]));

  const visible = listGames(db).map((g) => g.title);
  assert.ok(visible.includes("Football Manager 2024"), "the real game stays");
  assert.ok(!visible.includes("Football Manager 2024 Pre-game editor"), "the editor is hidden");
  assert.ok(!visible.includes("Football Manager 2024 Resource archiver"), "and the archiver");
  assert.ok(!visible.includes("The Last Caretaker Demo"), "so is the demo");
  assert.equal(listGames(db, { all: true }).length, 5, "nothing is deleted, only hidden");
});

test("expansions and mods stay visible; DLC does not", async () => {
  const db = await seeded("steam", "Dawn of War II: Retribution", "Some DLC Pack");
  const { classifyGames } = await import("./match.js");
  await matchEntitlements(
    db,
    "steam",
    async () => new Map(),
    async () =>
      new Map([
        ["dawn of war ii retribution", { igdb_id: 10, title: "Dawn of War II: Retribution" }],
        ["some dlc pack", { igdb_id: 11, title: "Some DLC Pack" }],
      ]),
  );
  // 2 = expansion, 1 = DLC
  await classifyGames(db, async () => new Map([[10, 2], [11, 1]]));

  assert.deepEqual(listGames(db).map((g) => g.title), ["Dawn of War II: Retribution"]);
});

test("a failed game_type lookup leaves everything visible", async () => {
  const db = await seeded("steam", "Hades");
  const { classifyGames } = await import("./match.js");
  await matchEntitlements(db, "steam", async () => new Map(), async () => new Map([["hades", { igdb_id: 2, title: "Hades" }]]));
  await classifyGames(db, async () => {
    throw new Error("IGDB 503");
  });
  assert.equal(listGames(db).length, 1, "hiding on a failed lookup would make games vanish");
});

// A Game IGDB identified carries the cover, genres and score; a title cluster
// carries none of them. An outage is not evidence the identification was wrong.
test("IGDB being down keeps what IGDB already identified rather than re-guessing it by title", async () => {
  const db = await seeded("epic", "Fallout 2: A Post Nuclear Role Playing Game");
  const found = async () => new Map();
  const byName = async () =>
    new Map([["fallout 2 a post nuclear role playing game", { igdb_id: 1, title: "Fallout 2" }]]);
  await matchEntitlements(db, "epic", found, byName);
  const before = db.prepare("SELECT game_id, confidence FROM entitlement").get();
  assert.equal(before.confidence, "igdb_name");

  const boom = async () => {
    throw new Error("IGDB 503");
  };
  await matchEntitlements(db, "epic", boom, boom);

  assert.deepEqual(db.prepare("SELECT game_id, confidence FROM entitlement").get(), before);
  assert.equal(db.prepare("SELECT count(*) c FROM game WHERE igdb_id = 1").get().c, 1, "the identified Game survives");
});

// docs/adr/0003: GeForce NOW streams the base game from any edition holding it.
test("an edition prices its base title only when no product carries the base title itself", () => {
  const byName = new Map([
    ["the witcher 3 wild hunt complete edition", "w3"],
    ["cyberpunk 2077", "cp"],
    ["cyberpunk 2077 ultimate edition", "cpu"],
    ["remnant ii standard edition", "r-std"],
    ["remnant ii deluxe edition", "r-dlx"],
    ["control ultimate edition", "c-ult"],
    ["control gold edition", "c-gold"],
    ["tomb raider anniversary", "tra"],
  ]);
  addEditions(byName, new Set());
  assert.equal(byName.get("the witcher 3 wild hunt"), "w3");
  assert.equal(byName.get("cyberpunk 2077"), "cp", "the base product wins over its edition");
  assert.equal(byName.get("remnant ii"), "r-std", "of several editions, the Standard one is the base game");
  assert.equal(byName.has("control"), false, "two editions and no Standard one is a guess");
  assert.equal(byName.has("tomb raider"), false, "Anniversary without Edition is its own game");
});
