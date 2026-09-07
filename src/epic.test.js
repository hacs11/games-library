import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential, credential } from "./db.js";
import { extractCode, fetchOwnedGames } from "./epic.js";

const future = () => new Date(Date.now() + 3600_000).toISOString();
const stub = (handler) => {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
};

test("the pasted JSON blob, or a bare code, both yield the authorization code", () => {
  const code = "5f4a2b1c9d8e7f6a5b4c3d2e1f0a9b8c";
  assert.equal(extractCode(`{"redirectUrl":"https://x","authorizationCode":"${code}","sid":null}`), code);
  assert.equal(extractCode(code), code);
  assert.equal(extractCode("nope"), null);
});

const ASSETS = [
  { appName: "Salt", catalogItemId: "cat-hades", namespace: "ns-hades" },
  { appName: "DlcThing", catalogItemId: "cat-dlc", namespace: "ns-hades" },
  { appName: "Plugin", catalogItemId: "cat-plugin", namespace: "ns-hades" },
  { appName: "EngineAsset", catalogItemId: "cat-ue", namespace: "ue" },
];
const CATALOG = {
  "cat-hades": { title: "Hades", categories: [{ path: "games" }] },
  "cat-dlc": { title: "Hades DLC", categories: [{ path: "games" }], mainGameItem: { id: "cat-hades" } },
  "cat-plugin": { title: "Some Plugin", categories: [{ path: "plugins" }] },
};

const epicStub = () =>
  stub(async (url) => {
    if (String(url).includes("/assets/Windows")) return Response.json(ASSETS);
    if (String(url).includes("/bulk/items")) {
      const ids = [...new URL(url).searchParams.getAll("id")];
      return Response.json(Object.fromEntries(ids.filter((i) => CATALOG[i]).map((i) => [i, CATALOG[i]])));
    }
    throw new Error(`unexpected ${url}`);
  });

test("only base games survive: DLC, plugins and Unreal Engine content are dropped", async () => {
  const db = open(":memory:");
  const restore = epicStub();
  try {
    const games = await fetchOwnedGames({ access_token: "t", expires_at: future() }, db);
    assert.deepEqual(games.map((g) => g.store_title), ["Hades"]);
  } finally {
    restore();
  }
});

// IGDB indexes one of Epic's two 32-hex ids and it is not documented which,
// so both are kept and matching tries each.
test("both Epic ids are kept for matching", async () => {
  const db = open(":memory:");
  const restore = epicStub();
  try {
    const [game] = await fetchOwnedGames({ access_token: "t", expires_at: future() }, db);
    assert.equal(game.store_game_id, "cat-hades");
    assert.equal(game.alt_id, "ns-hades");
  } finally {
    restore();
  }
});

test("an expired refresh token asks for a reconnect rather than retrying", async () => {
  const db = open(":memory:");
  saveCredential(db, "epic", { refresh_token: "r", expires_at: "2020-01-01T00:00:00.000Z" });
  const restore = stub(async () =>
    Response.json({ errorCode: "errors.com.epicgames.account.auth_token.invalid_refresh_token", errorMessage: "expired" }, { status: 400 }),
  );
  try {
    await assert.rejects(
      () => fetchOwnedGames(credential(db, "epic").data, db),
      (err) => err.reauth === true,
    );
  } finally {
    restore();
  }
});
