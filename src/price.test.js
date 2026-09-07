import { test } from "node:test";
import assert from "node:assert/strict";
import { open, discoverGames, discoverCount, priceCounts } from "./db.js";
import { syncAppIds, fetchPrices } from "./steam.js";
import { syncGfn } from "./gfn.js";

const stub = (handler) => {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
};

const CLOUDGG = [
  { title: "Baldur's Gate 3", variants: [{ id: "1", appStore: "STEAM" }, { id: "2", appStore: "GOG" }] },
  { title: "Control", variants: [{ id: "3", appStore: "EPIC" }] },
  { title: "Hades", variants: [{ id: "4", appStore: "STEAM" }] },
];

// Two apps share "Hades" — its price must not be guessed from either.
const APPS = [
  { appid: 1086940, name: "Baldur's Gate 3" },
  { appid: 1145360, name: "Hades" },
  { appid: 9999999, name: "hades" },
];

const PRICES = {
  1086940: { currency: "AUD", final: 8995, initial: 8995, discount_percent: 0, final_formatted: "A$ 89.95" },
  1145360: { currency: "AUD", final: 1499, initial: 2995, discount_percent: 50, final_formatted: "A$ 14.99" },
};

const seeded = async () => {
  const db = open(":memory:");
  let restore = stub(async (url) =>
    String(url).includes("cloud.gg")
      ? Response.json({ success: true, data: String(url).includes("/list/0/") ? CLOUDGG : [] })
      : Response.json([]),
  );
  try {
    await syncGfn(db);
  } finally {
    restore();
  }

  restore = stub(async (url) => {
    const u = String(url);
    if (u.includes("GetAppList")) return Response.json({ response: { apps: APPS, have_more_results: false } });
    const ids = new URL(u).searchParams.get("appids").split(",");
    return Response.json(
      Object.fromEntries(ids.map((id) => [id, { success: true, data: PRICES[id] ? { price_overview: PRICES[id] } : {} }])),
    );
  });
  try {
    await syncAppIds(db, { api_key: "k" });
    await fetchPrices(db, { delay: 0 });
  } finally {
    restore();
  }
  return db;
};

test("a title claimed by two Steam apps is left unpriced rather than guessed", async () => {
  const db = await seeded();
  const games = Object.fromEntries(discoverGames(db).map((g) => [g.title, g]));
  assert.equal(games["Baldur's Gate 3"].price, "A$ 89.95");
  assert.equal(games["Hades"].price, null, "two apps answer to Hades, so no price is claimed");
});

test("titles no Steam app matches simply have no price", async () => {
  const db = await seeded();
  const control = discoverGames(db).find((g) => g.title === "Control");
  assert.equal(control.price, null, "Epic-only, and Epic publishes no reachable price");
  assert.equal(control.discount, null);
});

test("the on-sale filter and discount sort use the real discount", async () => {
  const db = open(":memory:");
  db.exec(`
    INSERT INTO gfn_entry (title, norm_title, store, status) VALUES
      ('Full Price', 'full price', 'STEAM', 'AVAILABLE'),
      ('Half Off', 'half off', 'STEAM', 'AVAILABLE');
    INSERT INTO steam_app (norm_title, appid) VALUES ('full price', '1'), ('half off', '2');
    INSERT INTO steam_price (appid, currency, final_cents, discount_percent, formatted, fetched_at) VALUES
      ('1', 'AUD', 5000, 0, 'A$ 50.00', 'now'),
      ('2', 'AUD', 2500, 50, 'A$ 25.00', 'now');
  `);

  assert.deepEqual(discoverGames(db, { sale: true }).map((g) => g.title), ["Half Off"]);
  assert.deepEqual(discoverGames(db, { sort: "discount" }).map((g) => g.title), ["Half Off", "Full Price"]);
  assert.equal(discoverCount(db, { sale: true }), 1);
  assert.deepEqual(priceCounts(db), { apps: 2, priced: 2, onSale: 1 });
});
