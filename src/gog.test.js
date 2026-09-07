import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential, credential } from "./db.js";
import { extractCode, fetchOwnedGames } from "./gog.js";

const future = () => new Date(Date.now() + 3600_000).toISOString();
const stub = (handler) => {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
};

test("the pasted login URL, or a bare code, both yield the code", () => {
  const code = "abcdef1234567890";
  assert.equal(extractCode(`https://embed.gog.com/on_login_success?origin=client&code=${code}`), code);
  assert.equal(extractCode(`  ${code}  `), code);
  assert.equal(extractCode("nope"), null);
});

test("every page of the GOG library is collected", async () => {
  const db = open(":memory:");
  const pages = {
    1: { totalPages: 2, products: [{ id: 1207659220, title: "Eschalon: Book II" }] },
    2: { totalPages: 2, products: [{ id: 1458729425, title: "Skyhill" }] },
  };
  const restore = stub(async (url) => Response.json(pages[new URL(url).searchParams.get("page")]));
  try {
    const games = await fetchOwnedGames({ access_token: "t", expires_at: future() }, db);
    assert.deepEqual(games.map((g) => g.store_game_id), ["1207659220", "1458729425"]);
    assert.equal(games[1].store_title, "Skyhill");
  } finally {
    restore();
  }
});

test("an expired access token is refreshed and the new one is kept", async () => {
  const db = open(":memory:");
  saveCredential(db, "gog", { refresh_token: "r", expires_at: "2020-01-01T00:00:00.000Z" });
  const restore = stub(async (url) =>
    String(url).startsWith("https://auth.gog.com/token")
      ? Response.json({ access_token: "fresh", refresh_token: "r2", expires_in: 3600 })
      : Response.json({ totalPages: 1, products: [] }),
  );
  try {
    await fetchOwnedGames(credential(db, "gog").data, db);
  } finally {
    restore();
  }
  assert.equal(credential(db, "gog").data.access_token, "fresh");
  assert.equal(credential(db, "gog").data.refresh_token, "r2", "the rotated refresh token is stored");
});

// An expired login needs the user, not a retry — the Connect page says so.
test("a rejected token is flagged for re-auth, not reported as a broken Sync", async () => {
  const db = open(":memory:");
  const restore = stub(async () => new Response("", { status: 401 }));
  try {
    await assert.rejects(
      () => fetchOwnedGames({ access_token: "t", expires_at: future() }, db),
      (err) => err.reauth === true && /reconnect/i.test(err.message),
    );
  } finally {
    restore();
  }
});
