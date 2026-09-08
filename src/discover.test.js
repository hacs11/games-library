import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential, discoverGames, discoverCount, toggleWatch, watchCount, genreList } from "./db.js";
import { syncGfn } from "./gfn.js";
import { fetchMetacritic, pendingCount } from "./steam.js";
import { syncStore } from "./sync.js";
import { matchEntitlements } from "./match.js";

const CLOUDGG = [
  { title: "Baldur's Gate 3", genres: ["ROLE_PLAYING"], variants: [{ id: "1", appStore: "STEAM" }, { id: "2", appStore: "GOG" }] },
  { title: "  Colony Survival  ", variants: [{ id: "3", appStore: "STEAM" }] },
  { title: "Halo Infinite", variants: [{ id: "4", appStore: "XBOX" }, { id: "5", appStore: "STEAM" }] },
  { title: "Portal 2", genres: ["PUZZLE"], variants: [{ id: "6", appStore: "STEAM" }] },
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

test("the genre filter narrows Discover the way it narrows the Library", async () => {
  const db = await library();
  assert.deepEqual(
    discoverGames(db, { genre: "Role Playing" }).map((g) => g.title),
    ["Baldur's Gate 3"],
  );
  assert.ok(genreList(db, "gfn_entry").includes("Role Playing"));
  assert.equal(genreList(db).length, 0);
});

// A score is a property of the Game, not of the Store selling it — the opposite
// of a price, which docs/adr/0003 ties to the Store GeForce NOW lists.
test("a Metacritic score shows on Discover even for a store GeForce NOW does not list the title under", async () => {
  const db = await library();
  db.exec(`INSERT INTO steam_app (norm_title, appid) VALUES ('baldur s gate 3', '1086940')`);
  db.exec(`INSERT INTO steam_rating (appid, score, url, fetched_at)
             VALUES ('1086940', 96, 'https://metacritic.test/bg3', '2026-01-01')`);
  // GeForce NOW lists this one under GOG as well as Steam; the price rules
  // would gate on that, the score does not.
  db.exec(`UPDATE gfn_entry SET store = 'GOG' WHERE norm_title = 'baldur s gate 3'`);

  const [bg3] = discoverGames(db, { q: "Baldur" });
  assert.equal(bg3.rating, 96);
  assert.equal(bg3.rating_url, "https://metacritic.test/bg3");
  assert.equal(discoverGames(db, { q: "Portal" })[0]?.rating ?? null, null);
});

test("the score sweep asks for owned appids before the catalogue's", async () => {
  const db = await library();
  db.exec(`INSERT INTO steam_app (norm_title, appid) VALUES ('colony survival', '9999')`);
  // 620 is owned; 9999 is only in the Discover catalogue.
  assert.equal(pendingCount(db), 2);
  const asked = [];
  const restore = stub(async (url) => {
    asked.push(new URL(String(url)).searchParams.get("appids"));
    return Response.json({});
  });
  try {
    await fetchMetacritic(db, { delay: 0 });
  } finally {
    restore();
  }
  assert.deepEqual(asked, ["620", "9999"]);
  assert.equal(pendingCount(db), 0);
});
