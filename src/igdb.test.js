import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential } from "./db.js";
import { identify, identifyByName } from "./igdb.js";

// external_game_sources returns display names ("Epic Games Store"), not the
// snake_case spellings of IGDB's deprecated `category` enum.
const SOURCES = [
  { id: 1, name: "Steam" },
  { id: 5, name: "GOG" },
  { id: 26, name: "Epic Games Store" },
];

const connected = () => {
  const db = open(":memory:");
  saveCredential(db, "igdb", {
    client_id: "c",
    client_secret: "s",
    access_token: "t",
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });
  return db;
};

const stubFetch = (handler) => {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
};

test("every Store we sync resolves to an IGDB source id", async () => {
  const db = connected();
  const seen = [];
  const restore = stubFetch(async (url, opts) => {
    if (String(url).endsWith("external_game_sources")) return Response.json(SOURCES);
    seen.push(opts.body);
    return Response.json([{ uid: "1", game: { id: 42, name: "Hades" } }]);
  });
  try {
    for (const store of ["steam", "gog", "epic"]) {
      const found = await identify(db, store, ["1"]);
      assert.equal(found.get("1").igdb_id, 42, `${store} resolved`);
    }
  } finally {
    restore();
  }
  assert.match(seen[0], /external_game_source = 1/);
  assert.match(seen[1], /external_game_source = 5/);
  assert.match(seen[2], /external_game_source = 26/);
});

// The bug that put a whole 193-game library in the review tray: an unknown
// source name returned an empty result instead of failing.
test("an unknown source name fails loudly instead of matching nothing", async () => {
  const db = connected();
  const restore = stubFetch(async () => Response.json([{ id: 99, name: "Something Else" }]));
  try {
    await assert.rejects(() => identify(db, "steam", ["1"]), /no external game source named "Steam".*Something Else/s);
  } finally {
    restore();
  }
});

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

test("a title IGDB knows only as an alternative name still identifies", async () => {
  const db = connected();
  const asked = [];
  const restore = stubFetch(async (url, opts) => {
    const endpoint = String(url).split("/").pop();
    asked.push(endpoint);
    if (endpoint === "games") return Response.json([]); // no canonical hit
    return Response.json([
      { name: "Fallout 2: A Post Nuclear Role Playing Game", game: { id: 14, name: "Fallout 2" } },
    ]);
  });
  try {
    const found = await identifyByName(db, ["Fallout 2: A Post Nuclear Role Playing Game"], norm);
    assert.deepEqual(found.get("fallout 2 a post nuclear role playing game"), {
      igdb_id: 14,
      title: "Fallout 2",
    });
  } finally {
    restore();
  }
  assert.deepEqual(asked, ["games", "alternative_names"], "aliases are a fallback, not the first resort");
});

test("the canonical name wins and no alias lookup is made", async () => {
  const db = connected();
  const asked = [];
  const restore = stubFetch(async (url) => {
    const endpoint = String(url).split("/").pop();
    asked.push(endpoint);
    return Response.json(endpoint === "games" ? [{ id: 7, name: "Hades" }] : []);
  });
  try {
    const found = await identifyByName(db, ["Hades"], norm);
    assert.equal(found.get("hades").igdb_id, 7);
  } finally {
    restore();
  }
  assert.deepEqual(asked, ["games"], "no alias query when every title already matched");
});

test("an alias claimed by two different games is rejected", async () => {
  const db = connected();
  const restore = stubFetch(async (url) =>
    Response.json(
      String(url).endsWith("games")
        ? []
        : [
            { name: "Make Way", game: { id: 1, name: "Make Way" } },
            { name: "Make Way", game: { id: 2, name: "Make Way (2023)" } },
          ],
    ),
  );
  try {
    assert.equal((await identifyByName(db, ["Make Way"], norm)).size, 0);
  } finally {
    restore();
  }
});
