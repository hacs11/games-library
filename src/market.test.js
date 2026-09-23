import { test } from "node:test";
import assert from "node:assert/strict";
import { open, discoverGames, discoverDetail, priceCounts, gameDetail } from "./db.js";
import { discoverPage, discoverPanel, detailPanel } from "./views.js";
import { fetchMarketLows, pendingCount } from "./ggdeals.js";

const stub = (handler) => {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
};

// Two catalogue titles: one GeForce NOW sells through Steam and this app prices
// itself, one it sells through Epic alone — which ADR-0005 leaves unpriced, and
// which only has a Steam appid because NVIDIA's own list carries one.
const seeded = () => {
  const db = open(":memory:");
  db.exec(`
    INSERT INTO gfn_entry (title, norm_title, store, status) VALUES
      ('Half Off', 'half off', 'STEAM', 'AVAILABLE'),
      ('Epic Only', 'epic only', 'EPIC', 'AVAILABLE');
    INSERT INTO gfn_entry (title, norm_title, steam_appid, status) VALUES
      ('Epic Only', 'epic only', '222', 'AVAILABLE');
    INSERT INTO steam_app (norm_title, appid) VALUES ('half off', '111');
    INSERT INTO catalogue_price (store, store_id, currency, final_cents, initial_cents, discount_percent, formatted, fetched_at) VALUES
      ('steam', '111', 'AUD', 2500, 5000, 50, 'A$ 25.00', 'now');
  `);
  return db;
};

const GG = {
  111: {
    title: "Half Off",
    url: "https://gg.deals/game/half-off/",
    prices: { currentRetail: "25.00", currentKeyshops: "18.49", historicalRetail: "12.50", historicalKeyshops: "9.99", currency: "AUD" },
  },
  222: {
    title: "Epic Only",
    url: "https://gg.deals/game/epic-only/",
    prices: { currentRetail: "44.95", currentKeyshops: null, historicalRetail: "22.47", historicalKeyshops: null, currency: "AUD" },
  },
};

const fetched = async (db, data = GG) => {
  const asked = [];
  const restore = stub(async (url) => {
    const p = new URL(String(url)).searchParams;
    asked.push(p.get("ids").split(","));
    assert.equal(p.get("region"), "au");
    assert.equal(p.get("key"), "k");
    return Response.json({ success: true, data });
  });
  try {
    return { ...(await fetchMarketLows(db, { key: "k" }, { delay: 0 })), asked };
  } finally {
    restore();
  }
};

test("a market low is asked for by Steam appid and stored in cents", async () => {
  const db = seeded();
  assert.equal(pendingCount(db), 2);
  const { asked, priced } = await fetched(db);
  assert.deepEqual(asked.map((ids) => ids.toSorted()), [["111", "222"]], "one request, both appids, 100 per request");
  assert.equal(priced, 2);

  const item = discoverDetail(db, "half off");
  assert.deepEqual(item.market, {
    retail: 2500,
    keyshop: 1849,
    retail_low: 1250,
    keyshop_low: 999,
    currency: "AUD",
    url: "https://gg.deals/game/half-off/",
  });
  assert.deepEqual(priceCounts(db).market.priced, 2);
});

// docs/adr/0006: the free tier does not say which store a market low came from,
// and docs/adr/0003 only shows a price for a store GeForce NOW lists the title
// under — so a market low can never be a store price or a store's discount.
test("a market low is never a store price and never a discount (docs/adr/0006)", async () => {
  const db = seeded();
  await fetched(db);

  const item = discoverDetail(db, "epic only");
  assert.deepEqual(item.prices, [], "Epic publishes no price this app can read");
  assert.equal(item.best_discount, null, "a market low is not a sale on any store row");
  assert.equal(item.best_price, null, "nor is it the cheapest price of a store you could stream from");
  assert.equal(item.market.retail, 4495, "it is its own figure, and it is there");

  const halfOff = discoverDetail(db, "half off");
  assert.equal(halfOff.best_discount, 50, "Steam's own discount is untouched");
  assert.deepEqual(halfOff.prices.map((p) => p.store), ["steam"]);
});

// The grid is not an attribution-bearing surface and shows no market low, so it
// must not carry one in its rows either.
test("the Discover grid carries no market low, only the detail panel does", async () => {
  const db = seeded();
  await fetched(db);
  for (const g of discoverGames(db)) assert.equal(g.market, null);
});

test("an appid gg.deals does not know is remembered as no market low, not skipped", async () => {
  const db = seeded();
  await fetched(db, { 111: null, 222: null });
  assert.equal(priceCounts(db).market.asked, 2);
  assert.equal(priceCounts(db).market.priced, 0);
  assert.equal(discoverDetail(db, "half off").market, null);
});

test("a bad key fails the sweep loudly rather than recording empty prices", async () => {
  const db = seeded();
  const restore = stub(async () =>
    Response.json({ success: false, data: { message: "Invalid key." } }, { status: 400 }),
  );
  try {
    await assert.rejects(() => fetchMarketLows(db, { key: "nope" }, { delay: 0 }), /gg\.deals returned 400/);
  } finally {
    restore();
  }
  assert.equal(priceCounts(db).market.asked, 0);
});

// The figure reached the row object and still rendered nowhere: it had been
// written into the Library's panel, which has no market low and no `item`. Both
// panels are rendered here, because that is the only thing that catches it.
test("the Discover panel renders the market low and its gg.deals attribution", async () => {
  const db = seeded();
  await fetched(db);

  const html = discoverPanel(discoverDetail(db, "half off"), "/discover");
  assert.match(html, /Cheapest anywhere/);
  assert.match(html, /A\$25\.00/, "retail, in dollars");
  assert.match(html, /low A\$12\.50/, "and its all-time low");
  assert.match(html, /href="https:\/\/gg\.deals\/game\/half-off\/"/, "gg.deals requires the link wherever its data is shown");

  // The Library is games you already own, so it shows no market low — but it
  // must still render.
  db.exec(`
    INSERT INTO game (id, title, norm_title) VALUES (1, 'Half Off', 'half off');
    INSERT INTO entitlement (store, store_game_id, store_title, game_id, first_seen, last_seen)
      VALUES ('steam', '111', 'Half Off', 1, 'now', 'now');
  `);
  const owned = detailPanel(gameDetail(db, 1), "/");
  assert.match(owned, /Half Off/);
  assert.doesNotMatch(owned, /Cheapest anywhere/);
});

// gg.deals reports the current price as the historical low when the current
// price is the low, so equality — not a strict drop — is what "at an all-time
// low" means. `Half Off` is put on its low here; out of the box it sits at
// A$25.00 against a A$12.50 low.
const AT_LOW = { ...GG, 111: { ...GG[111], prices: { ...GG[111].prices, historicalRetail: "25.00" } } };

test("a title whose retail price equals its all-time low is marked, one above it is not", async () => {
  const db = seeded();
  await fetched(db, AT_LOW);
  assert.equal(discoverDetail(db, "half off").at_retail_low, true);

  const db2 = seeded();
  await fetched(db2, GG);
  assert.equal(discoverDetail(db2, "half off").at_retail_low, false, "a cent above the low is not the low");

  const only = discoverGames(db, { low: true }).map((g) => g.norm_title);
  assert.deepEqual(only, ["half off"], "the filter keeps only what the mark claims");
});

// A mark is a claim about a price the tile shows. `Epic Only` is at its
// all-time low and this app can price it nowhere (docs/adr/0005), so there is
// no price for the claim to be about and nothing to buy at it.
test("a title no store here prices is never marked, however low the market is", async () => {
  const db = seeded();
  await fetched(db, {
    ...AT_LOW,
    222: { ...GG[222], prices: { ...GG[222].prices, currentRetail: "22.47", historicalRetail: "22.47" } },
  });

  const marked = Object.fromEntries(discoverGames(db).map((g) => [g.norm_title, g.at_retail_low]));
  assert.deepEqual(marked, { "epic only": false, "half off": true });
  assert.equal(discoverDetail(db, "epic only").market.retail, 2247, "the figure is still in the panel");
});

// docs/adr/0006: a Market Low names no store, so — like the rating and unlike
// every price — it is not narrowed by the Discover store filter. GeForce NOW
// streams `Half Off` from Steam alone, so the mark survives a Steam filter and
// the title is absent under an Xbox one for the ordinary reason.
test("the all-time low filter is not gated by the store filter (docs/adr/0006)", async () => {
  const db = seeded();
  await fetched(db, AT_LOW);

  const titles = (store) => discoverGames(db, { low: true, store }).map((g) => g.norm_title);
  assert.deepEqual(titles("STEAM"), ["half off"]);
  assert.deepEqual(titles(""), ["half off"], "and the mark does not depend on a store being named");
  assert.deepEqual(titles("XBOX"), [], "GeForce NOW does not list it under Xbox at all");
});

// A keyshop is a reseller of keys, not a Store that grants an Entitlement, and
// its low is the noisier of the two — the mark means retail.
test("a keyshop at its all-time low does not mark the title", async () => {
  const db = seeded();
  await fetched(db, {
    ...GG,
    111: { ...GG[111], prices: { ...GG[111].prices, currentKeyshops: "9.99", historicalKeyshops: "9.99" } },
  });
  assert.equal(discoverDetail(db, "half off").at_retail_low, false);
});

// The grid shows gg.deals' data with no room for gg.deals' link, so the page
// carries the attribution the marks require.
test("the Discover grid marks an all-time low and attributes it once, page-wide", async () => {
  const db = seeded();
  await fetched(db, AT_LOW);

  const html = discoverPage(discoverGames(db), {}, 2, 0, [], []);
  assert.match(html, /class="low-badge"[^>]*>ATL</, "the mark is on the tile");
  assert.match(html, /href="https:\/\/gg\.deals\/"/, "attributed once for the whole grid");
});
