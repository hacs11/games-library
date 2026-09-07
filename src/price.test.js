import { test } from "node:test";
import assert from "node:assert/strict";
import { open, discoverGames, discoverCount, discoverDetail, priceCounts } from "./db.js";
import { syncAppIds, fetchPrices } from "./steam.js";
import { syncCatalogue } from "./gog.js";
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

const priceOf = (game, store) => game.prices.find((p) => p.store === store)?.formatted ?? null;

test("a title claimed by two Steam apps is left unpriced rather than guessed", async () => {
  const db = await seeded();
  const games = Object.fromEntries(discoverGames(db).map((g) => [g.title, g]));
  assert.equal(priceOf(games["Baldur's Gate 3"], "steam"), "A$ 89.95");
  assert.equal(priceOf(games["Hades"], "steam"), null, "two apps answer to Hades, so no price is claimed");
});

test("titles no Steam app matches simply have no price", async () => {
  const db = await seeded();
  const control = discoverGames(db).find((g) => g.title === "Control");
  assert.deepEqual(control.prices, [], "Epic-only, and Epic publishes no reachable price");
  assert.equal(control.best_discount, null);
});

test("the on-sale filter and discount sort use the real discount", async () => {
  const db = open(":memory:");
  db.exec(`
    INSERT INTO gfn_entry (title, norm_title, store, status) VALUES
      ('Full Price', 'full price', 'STEAM', 'AVAILABLE'),
      ('Half Off', 'half off', 'STEAM', 'AVAILABLE');
    INSERT INTO steam_app (norm_title, appid) VALUES ('full price', '1'), ('half off', '2');
    INSERT INTO catalogue_price (store, store_id, currency, final_cents, discount_percent, formatted, fetched_at) VALUES
      ('steam', '1', 'AUD', 5000, 0, 'A$ 50.00', 'now'),
      ('steam', '2', 'AUD', 2500, 50, 'A$ 25.00', 'now');
  `);

  assert.deepEqual(discoverGames(db, { sale: true }).map((g) => g.title), ["Half Off"]);
  assert.deepEqual(discoverGames(db, { sort: "discount" }).map((g) => g.title), ["Half Off", "Full Price"]);
  assert.equal(discoverCount(db, { sale: true }), 1);
  assert.deepEqual(priceCounts(db), {
    apps: 2,
    products: 0,
    steam: { priced: 2, onSale: 1 },
    gog: { priced: 0, onSale: 0 },
  });
});

const CATALOG = {
  pages: 1,
  products: [
    {
      id: 1456460669,
      title: "Baldur's Gate 3",
      price: { final: "$59.99", base: "$89.95", discount: "-33%",
               finalMoney: { amount: "59.99", currency: "AUD" }, baseMoney: { amount: "89.95", currency: "AUD" } },
    },
    {
      id: 111,
      title: "Hades",
      price: { final: "$14.99", base: "$29.95", discount: "-50%",
               finalMoney: { amount: "14.99", currency: "AUD" }, baseMoney: { amount: "29.95", currency: "AUD" } },
    },
    // Same normalised title as the one above: neither may be priced.
    { id: 222, title: "hades", price: { final: "$1.00", finalMoney: { amount: "1.00", currency: "AUD" } } },
  ],
};

const withGog = async () => {
  const db = await seeded();
  const restore = stub(async () => Response.json(CATALOG));
  try {
    await syncCatalogue(db);
  } finally {
    restore();
  }
  return db;
};

test("GOG prices come from its own catalogue, ambiguous titles excluded", async () => {
  const db = await withGog();
  assert.deepEqual(priceCounts(db).gog, { priced: 1, onSale: 1 });
  assert.equal(priceCounts(db).products, 1, "Hades is claimed by two products, so it is dropped");
});

test("a title sold on both stores shows both prices, cheapest discount leading the sort", async () => {
  const db = await withGog();
  const bg3 = discoverGames(db).find((g) => g.title === "Baldur's Gate 3");
  assert.deepEqual(
    bg3.prices.map((p) => [p.store, p.formatted, p.discount]),
    [["steam", "A$ 89.95", 0], ["gog", "A$59.99", 33]],
  );
  assert.equal(bg3.best_discount, 33, "the best of the two is what the sort and the badge use");
});

// docs/adr/0003: GeForce NOW support belongs to the Entitlement. A price for a
// store the catalogue does not list would be a purchase that does not stream.
test("a price is hidden for a store GeForce NOW does not list the title under", async () => {
  const db = open(":memory:");
  db.exec(`
    INSERT INTO gfn_entry (title, norm_title, store, status)
      VALUES ('Steam Only', 'steam only', 'STEAM', 'AVAILABLE');
    INSERT INTO steam_app (norm_title, appid) VALUES ('steam only', '1');
    INSERT INTO gog_app (norm_title, product_id) VALUES ('steam only', '900');
    INSERT INTO catalogue_price (store, store_id, currency, final_cents, discount_percent, formatted, fetched_at) VALUES
      ('steam', '1', 'AUD', 5000, 0, 'A$ 50.00', 'now'),
      ('gog', '900', 'AUD', 1000, 80, 'A$10.00', 'now');
  `);

  const game = discoverGames(db)[0];
  assert.deepEqual(game.prices.map((p) => p.store), ["steam"], "GOG sells it, but streaming it needs Steam");
});

test("the detail panel resolves one catalogue title by its normalised name", async () => {
  const db = await withGog();
  const item = discoverDetail(db, "baldur s gate 3");
  assert.equal(item.title, "Baldur's Gate 3");
  assert.deepEqual(item.stores, ["GOG", "STEAM"]);
  assert.deepEqual(item.prices.map((p) => p.store), ["steam", "gog"]);
  assert.equal(discoverDetail(db, "nothing here"), null);
});
