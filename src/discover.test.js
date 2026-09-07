import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential, discoverGames, discoverCount, toggleWatch, watchCount } from "./db.js";
import { syncGfn } from "./gfn.js";
import { syncStore } from "./sync.js";
import { matchEntitlements } from "./match.js";

const CLOUDGG = [
  { title: "Baldur's Gate 3", variants: [{ id: "1", appStore: "STEAM" }, { id: "2", appStore: "GOG" }] },
  { title: "  Colony Survival  ", variants: [{ id: "3", appStore: "STEAM" }] },
  { title: "Halo Infinite", variants: [{ id: "4", appStore: "XBOX" }, { id: "5", appStore: "STEAM" }] },
  { title: "Portal 2", variants: [{ id: "6", appStore: "STEAM" }] },
  { title: "Some Console Thing", variants: [{ id: "7", appStore: "NONE" }] },
];
const NVIDIA = [
  { title: "Portal 2", steamUrl: "https://store.steampowered.com/app/620", store: "Steam", status: "AVAILABLE" },
];

const stub = (handler) => {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
};

const library = async () => {
  const db = open(":memory:");
  saveCredential(db, "steam", { t: 1 });
  // Owned under a title that does not match the catalogue's: only the appid says so.
  await syncStore(db, "steam", async () => [{ store_game_id: "620", store_title: "Portal 2: Sponsored Edition" }]);
  await matchEntitlements(db, "steam", async () => new Map(), async () => new Map());

  const restore = stub(async (url) => {
    const u = String(url);
    if (u.includes("cloud.gg")) return Response.json({ success: true, data: u.includes("/list/0/") ? CLOUDGG : [] });
    return Response.json(NVIDIA);
  });
  try {
    await syncGfn(db);
  } finally {
    restore();
  }
  return db;
};

test("discover lists the catalogue minus what you own, with where to buy it", async () => {
  const db = await library();
  const games = discoverGames(db);

  assert.deepEqual(
    games.map((g) => [g.title, g.stores]),
    [
      ["Baldur's Gate 3", ["GOG", "STEAM"]],
      ["Colony Survival", ["STEAM"]],
      ["Halo Infinite", ["STEAM", "XBOX"]],
    ],
  );
  assert.equal(discoverCount(db), 3);
});

// Portal 2 is owned as "Portal 2: Sponsored Edition" and matched only by appid.
// Excluding by title alone would wrongly offer to sell it back to you.
test("a game owned under a different title is still excluded", async () => {
  const db = await library();
  assert.deepEqual(discoverGames(db, { q: "Portal" }), []);
  assert.equal(
    db.prepare("SELECT gfn_title FROM entitlement").get().gfn_title,
    "portal 2",
    "the matched catalogue entry is recorded on the Entitlement",
  );
});

test("catalogue titles are trimmed, and storeless entries are hidden", async () => {
  const db = await library();
  const titles = discoverGames(db).map((g) => g.title);
  assert.ok(titles.includes("Colony Survival"), "leading whitespace in the source is trimmed");
  assert.ok(!titles.includes("Some Console Thing"), "an entry with no purchasable store is not a shopping suggestion");
});

test("filtering by store narrows to what that store sells", async () => {
  const db = await library();
  assert.deepEqual(discoverGames(db, { store: "GOG" }).map((g) => g.title), ["Baldur's Gate 3"]);
  assert.deepEqual(discoverGames(db, { store: "XBOX" }).map((g) => g.title), ["Halo Infinite"]);
});

test("starring a title is a toggle, and the watchlist filter shows only what is starred", () => {
  const db = open(":memory:");
  db.exec(`
    INSERT INTO gfn_entry (title, norm_title, store, status) VALUES
      ('Kept', 'kept', 'STEAM', 'AVAILABLE'),
      ('Ignored', 'ignored', 'STEAM', 'AVAILABLE');
  `);

  assert.equal(toggleWatch(db, "kept"), true, "first press adds");
  assert.equal(watchCount(db), 1);
  assert.deepEqual(discoverGames(db, { watch: true }).map((g) => g.title), ["Kept"]);
  assert.equal(discoverGames(db).find((g) => g.title === "Kept").watched, true);
  assert.equal(discoverCount(db, { watch: true }), 1);

  assert.equal(toggleWatch(db, "kept"), false, "second press removes");
  assert.deepEqual(discoverGames(db, { watch: true }), []);
});
