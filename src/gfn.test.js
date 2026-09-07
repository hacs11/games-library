import { test } from "node:test";
import assert from "node:assert/strict";
import { open, saveCredential } from "./db.js";
import { syncGfn } from "./gfn.js";
import { syncStore } from "./sync.js";

// Shaped like Pentanet's /api/games/list response: one game, many variants,
// one per store it streams from.
const CLOUDGG = [
  {
    id: "uuid-1",
    title: "Fallout 3 Game of the Year Edition",
    variants: [
      { id: "102344811", appStore: "EPIC" },
      { id: "101610111", appStore: "STEAM" },
      { id: "102344911", appStore: "XBOX" },
    ],
  },
  { id: "uuid-2", title: "Cyberpunk 2077®", variants: [{ id: "9", appStore: "GOG" }] },
  { id: "uuid-3", title: "Portal 2", variants: [{ id: "10", appStore: "STEAM" }] },
];

// NVIDIA's supplementary file: Steam entries only, carrying appids.
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

const catalogue = (cloudgg = CLOUDGG, nvidia = NVIDIA) =>
  stub(async (url) => {
    const u = String(url);
    if (u.includes("cloud.gg")) {
      // Pages are zero-indexed — a fixture keyed on page 1 would pass even
      // if the sync skipped page 0 entirely.
      return Response.json({ success: true, data: u.includes("/list/0/") ? cloudgg : [] });
    }
    if (u.includes("nvidiagrid.net")) return Response.json(nvidia);
    throw new Error(`unexpected ${u}`);
  });

const library = async () => {
  const db = open(":memory:");
  for (const store of ["steam", "gog", "epic"]) saveCredential(db, store, { t: 1 });
  await syncStore(db, "steam", async () => [
    { store_game_id: "620", store_title: "Portal 2: Sponsored Edition" },
  ]);
  await syncStore(db, "gog", async () => [
    { store_game_id: "1", store_title: "Cyberpunk 2077" },
    { store_game_id: "2", store_title: "Fallout 3: Game of the Year Edition" },
  ]);
  await syncStore(db, "epic", async () => [
    { store_game_id: "3", store_title: "Fallout 3 Game of the Year Edition" },
    { store_game_id: "4", store_title: "Cyberpunk 2077" },
  ]);
  return db;
};

const statuses = (db) =>
  Object.fromEntries(
    db
      .prepare("SELECT store, store_title, gfn_status FROM entitlement")
      .all()
      .map((r) => [`${r.store}/${r.store_title}`, r.gfn_status]),
  );

test("support attaches per Entitlement: the same Game differs by Store", async () => {
  const db = await library();
  const restore = catalogue();
  try {
    const result = await syncGfn(db);
    assert.equal(result.games, 3);
    assert.equal(result.variants, 5);
  } finally {
    restore();
  }

  const s = statuses(db);
  assert.equal(s["epic/Fallout 3 Game of the Year Edition"], "AVAILABLE", "Epic has a variant");
  assert.equal(
    s["gog/Fallout 3: Game of the Year Edition"],
    null,
    "no GOG variant — the GOG copy must not inherit Epic's support",
  );
  assert.equal(s["gog/Cyberpunk 2077"], "AVAILABLE", "the trademark symbol normalises away");
  assert.equal(s["epic/Cyberpunk 2077"], null, "Cyberpunk streams from GOG, not Epic");
});

// The reason NVIDIA's otherwise-unusable file is still fetched.
test("a Steam appid matches where the title would not", async () => {
  const db = await library();
  const restore = catalogue();
  try {
    await syncGfn(db);
  } finally {
    restore();
  }
  assert.equal(
    statuses(db)["steam/Portal 2: Sponsored Edition"],
    "AVAILABLE",
    "appid 620 matches even though the title does not",
  );
});

test("the Steam appid list failing does not fail the Sync", async () => {
  const db = await library();
  const restore = stub(async (url) =>
    String(url).includes("cloud.gg")
      ? Response.json({ success: true, data: String(url).includes("/list/0/") ? CLOUDGG : [] })
      : Promise.reject(new Error("nvidiagrid down")),
  );
  try {
    await syncGfn(db);
  } finally {
    restore();
  }
  const s = statuses(db);
  assert.equal(s["epic/Fallout 3 Game of the Year Edition"], "AVAILABLE", "the main catalogue still applied");
  assert.equal(s["steam/Portal 2: Sponsored Edition"], null, "only the appid-only match is lost");
});

// A truncated or empty response would otherwise wipe every badge in the library.
test("an empty catalogue is refused rather than applied", async () => {
  const db = await library();
  let restore = catalogue();
  try {
    await syncGfn(db);
  } finally {
    restore();
  }
  const before = db.prepare("SELECT count(*) c FROM entitlement WHERE gfn_status IS NOT NULL").get().c;

  restore = catalogue([], []);
  try {
    await assert.rejects(() => syncGfn(db), /empty catalogue/);
  } finally {
    restore();
  }
  assert.equal(
    db.prepare("SELECT count(*) c FROM entitlement WHERE gfn_status IS NOT NULL").get().c,
    before,
    "the previous badges survive a bad sync",
  );
});
