import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential, listGames, genreList } from "./db.js";
import { syncStore } from "./sync.js";
import { matchEntitlements, enrichGames } from "./match.js";
import { syncGfn } from "./gfn.js";

const stub = (handler) => {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
};

const CLOUDGG = [
  {
    title: "Baldur's Gate 3",
    genres: ["ROLE_PLAYING", "TURN_BASED_STRATEGY"],
    images: { KEY_ART: "https://img.nvidiagrid.net/apps/bg3.jpg" },
    variants: [{ id: "1", appStore: "STEAM" }],
  },
];

const library = async () => {
  const db = open(":memory:");
  saveCredential(db, "steam", { t: 1 });
  await syncStore(db, "steam", async () => [
    { store_game_id: "1", store_title: "Hades" },
    { store_game_id: "2", store_title: "Baldur's Gate 3" },
  ]);
  await matchEntitlements(
    db,
    "steam",
    async () => new Map(),
    async () => new Map([["hades", { igdb_id: 7, title: "Hades" }]]),
  );
  const restore = stub(async (url) =>
    String(url).includes("cloud.gg")
      ? Response.json({ success: true, data: String(url).includes("/list/0/") ? CLOUDGG : [] })
      : Response.json([]),
  );
  try {
    await syncGfn(db);
  } finally {
    restore();
  }
  return db;
};

test("IGDB supplies art and genres where it identified the Game", async () => {
  const db = await library();
  await enrichGames(db, async () =>
    new Map([[7, { cover_url: "https://images.igdb.com/co1.jpg", genres: "Action, Indie" }]]),
  );
  const hades = listGames(db).find((g) => g.title === "Hades");
  assert.equal(hades.cover_url, "https://images.igdb.com/co1.jpg");
  assert.equal(hades.genres, "Action, Indie");
});

// A game IGDB never identified still gets art, because the GeForce NOW
// catalogue carries key art and genres for everything in it.
test("the GeForce NOW catalogue fills in what IGDB could not", async () => {
  const db = await library();
  await enrichGames(db, async () => new Map());

  const bg3 = listGames(db).find((g) => g.title.startsWith("Baldur"));
  assert.equal(bg3.cover_url, "https://img.nvidiagrid.net/apps/bg3.jpg");
  assert.equal(bg3.genres, "Role Playing, Turn Based Strategy", "SCREAMING_SNAKE is made readable");
});

test("failed artwork lookup leaves the library usable", async () => {
  const db = await library();
  await enrichGames(db, async () => {
    throw new Error("IGDB 503");
  });
  assert.equal(listGames(db).length, 2, "art is decoration — its absence is not a failure");
});

test("genres are filterable individually, not as whole strings", async () => {
  const db = await library();
  await enrichGames(db, async () =>
    new Map([[7, { cover_url: null, genres: "Action, Indie" }]]),
  );
  assert.deepEqual(genreList(db), ["Action", "Indie", "Role Playing", "Turn Based Strategy"]);
  assert.deepEqual(listGames(db, { genre: "Indie" }).map((g) => g.title), ["Hades"]);
});
