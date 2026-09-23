import { test } from "node:test";
import assert from "node:assert/strict";
import { open, listGames, saveCredential, credential } from "./db.js";
import { normaliseTitle, resolveGame } from "./match.js";
import { syncStore } from "./sync.js";
import { fetchOwnedGames } from "./steam.js";

const connected = () => {
  const db = open(":memory:");
  saveCredential(db, "steam", { api_key: "k", steam_id: "1" });
  return db;
};
const fake = (...titles) => async () =>
  titles.map((t, i) => ({ store_game_id: String(i), store_title: t }));

test("titles normalise to the same Game across Stores", () => {
  assert.equal(normaliseTitle("Cyberpunk 2077®"), normaliseTitle("cyberpunk  2077"));
  assert.notEqual(normaliseTitle("Deus Ex"), normaliseTitle("Deus Ex: Mankind Divided"));

  const db = open(":memory:");
  assert.equal(resolveGame(db, "Hades"), resolveGame(db, "HADES"));
});

test("re-syncing is idempotent and keeps Entitlements that vanish", async () => {
  const db = connected();
  await syncStore(db, "steam", fake("Hades", "Bastion"));
  await new Promise((r) => setTimeout(r, 5)); // last_seen is ISO ms — separate the two Syncs
  await syncStore(db, "steam", fake("Hades")); // Bastion refunded/delisted

  const rows = db.prepare("SELECT store_title, last_seen FROM entitlement ORDER BY id").all();
  assert.equal(rows.length, 2, "vanished Entitlement is kept, not deleted");
  assert.ok(rows[0].last_seen > rows[1].last_seen, "only the still-owned one is re-stamped");
  assert.equal(listGames(db).length, 2);
});

test("a manual match is locked against later Syncs", async () => {
  const db = connected();
  await syncStore(db, "steam", fake("Hades"));
  db.exec("INSERT INTO game (title, norm_title) VALUES ('Correct', 'correct')");
  const correct = db.prepare("SELECT id FROM game WHERE norm_title = 'correct'").get().id;
  db.prepare("UPDATE entitlement SET game_id = ?, locked = 1").run(correct);

  await syncStore(db, "steam", fake("Hades"));
  assert.equal(db.prepare("SELECT game_id FROM entitlement").get().game_id, correct);
});

test("a failed Sync records the error on that Store and does not throw it away", async () => {
  const db = connected();
  const boom = async () => {
    throw new Error("Steam returned 403 Forbidden");
  };
  await assert.rejects(() => syncStore(db, "steam", boom));

  const row = credential(db, "steam");
  assert.equal(row.status, "error");
  assert.match(row.last_error, /403/);
  assert.equal(db.prepare("SELECT count(*) c FROM entitlement").get().c, 0);
});

test("a private Steam profile is reported as a connection problem, not zero games", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ response: {} }));
  try {
    await assert.rejects(() => fetchOwnedGames({ api_key: "k", steam_id: "1" }), /Game Details to Public/);
  } finally {
    globalThis.fetch = real;
  }
});

// IGDB is asked mid-Sync, over the network, for seconds at a time. A Library
// rendered in that window — or left behind by a crash inside it — must not lose
// every Game whose Entitlements were just re-stamped.
test("a resync leaves each Entitlement on its Game while IGDB is being asked", async () => {
  const db = connected();
  await syncStore(db, "steam", fake("Hades", "Bastion"));
  saveCredential(db, "igdb", { client_id: "c", client_secret: "s" });

  const real = globalThis.fetch;
  let orphaned = null;
  globalThis.fetch = async () => {
    orphaned ??= db.prepare("SELECT count(*) c FROM entitlement WHERE game_id IS NULL").get().c;
    return new Response("", { status: 500 });
  };
  try {
    await syncStore(db, "steam", fake("Hades", "Bastion"));
  } finally {
    globalThis.fetch = real;
  }
  assert.equal(orphaned, 0);
  assert.equal(listGames(db).length, 2);
});
