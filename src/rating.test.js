import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential, listGames, ratingCounts } from "./db.js";
import { syncStore } from "./sync.js";
import { matchEntitlements, rateGames } from "./match.js";
import { fetchMetacritic, pendingCount } from "./steam.js";

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
  saveCredential(db, "epic", { t: 1 });
  await syncStore(db, "steam", async () => [
    { store_game_id: "620", store_title: "Portal 2" },
    { store_game_id: "999", store_title: "Obscure Thing" },
  ]);
  await syncStore(db, "epic", async () => [{ store_game_id: "e1", store_title: "Control" }]);
  const named = async () =>
    new Map([
      ["portal 2", { igdb_id: 1, title: "Portal 2" }],
      ["control", { igdb_id: 2, title: "Control" }],
      ["obscure thing", { igdb_id: 3, title: "Obscure Thing" }],
    ]);
  await matchEntitlements(db, "steam", async () => new Map(), named);
  await matchEntitlements(db, "epic", async () => new Map(), named);
  return db;
};

const steamStub = (scores) =>
  stub(async (url) => {
    const appid = new URL(url).searchParams.get("appids");
    return Response.json({
      [appid]: {
        success: true,
        data: scores[appid] ? { metacritic: { score: scores[appid], url: `https://metacritic.com/${appid}` } } : {},
      },
    });
  });

test("Metacritic wins over the IGDB aggregate, and says which it is", async () => {
  const db = await library();
  let restore = steamStub({ 620: 95 });
  try {
    assert.deepEqual(await fetchMetacritic(db, { delay: 0 }), { asked: 2, found: 1, remaining: 0 });
  } finally {
    restore();
  }
  await rateGames(db, async () => new Map([[1, { score: 88, count: 20 }], [2, { score: 81, count: 12 }]]));

  const games = Object.fromEntries(listGames(db).map((g) => [g.title, g]));
  assert.equal(games["Portal 2"].rating, 95, "Steam's real Metacritic beats IGDB's 88");
  assert.equal(games["Portal 2"].rating_source, "metacritic");
  assert.match(games["Portal 2"].rating_url, /metacritic\.com/);

  assert.equal(games["Control"].rating, 81, "no Steam copy, so the aggregate is used");
  assert.equal(games["Control"].rating_source, "igdb:12", "the review count travels with the score");
  assert.equal(games["Control"].rating_url, null);

  // Obscure Thing has no score from either source, so it stays unrated.
  assert.deepEqual(ratingCounts(db), { metacritic: 1, igdb: 1 });
});

// 193 rate-limited requests: asking twice for a game with no score would burn
// the budget forever on the same misses.
test("appids are asked once, misses included", async () => {
  const db = await library();
  let calls = 0;
  const restore = stub(async (url) => {
    calls++;
    const appid = new URL(url).searchParams.get("appids");
    return Response.json({ [appid]: { success: true, data: {} } });
  });
  try {
    await fetchMetacritic(db, { delay: 0 });
    assert.equal(calls, 2);
    assert.equal(pendingCount(db), 0, "a miss is remembered, not retried");
    await fetchMetacritic(db, { delay: 0 });
    assert.equal(calls, 2, "the second run asks for nothing");
  } finally {
    restore();
  }
});

test("a rate limit stops the run instead of hammering", async () => {
  const db = await library();
  let calls = 0;
  const restore = stub(async () => {
    calls++;
    return new Response("", { status: 429 });
  });
  try {
    await fetchMetacritic(db, { delay: 0 });
  } finally {
    restore();
  }
  assert.equal(calls, 1, "stopped at the first 429");
  assert.equal(pendingCount(db), 2, "nothing was recorded, so both are retried next time");
});

test("sorting by score puts the unrated last, not first", async () => {
  const db = await library();
  await rateGames(db, async () => new Map([[1, { score: 60, count: 9 }], [2, { score: 90, count: 9 }]]));
  assert.deepEqual(listGames(db, { sort: "rating" }).map((g) => g.title), [
    "Control",
    "Portal 2",
    "Obscure Thing",
  ]);
});
