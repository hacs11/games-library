import { normaliseTitle } from "./match.js";

// Xbox has no reachable "what do I own" endpoint, so its Entitlements are typed
// in by hand (docs/adr/0002). There is no Sync to correct a mistake with, which
// is why these are the only Entitlements the app lets you delete.
export const XBOX = "xbox";

// The normalised title is the id: pasting the same list twice must not create
// duplicates, and there is no store id to use instead.
const idFor = (title) => normaliseTitle(title).replace(/ /g, "-");

export function addTitles(db, pasted) {
  const titles = pasted
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && normaliseTitle(t).length > 0);

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO entitlement (store, store_game_id, store_title, first_seen, last_seen)
          VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (store, store_game_id) DO UPDATE SET store_title = excluded.store_title`,
  );

  const before = count(db);
  for (const title of titles) insert.run(XBOX, idFor(title), title, now, now);
  return { pasted: titles.length, added: count(db) - before };
}

export const count = (db) =>
  db.prepare("SELECT count(*) c FROM entitlement WHERE store = ?").get(XBOX).c;

export const list = (db) =>
  db
    .prepare(
      `SELECT e.id, e.store_title, e.gfn_status, g.title AS game
         FROM entitlement e
         LEFT JOIN game g ON g.id = e.game_id
        WHERE e.store = ?
        ORDER BY e.store_title COLLATE NOCASE`,
    )
    .all(XBOX);

export function remove(db, id) {
  db.prepare("DELETE FROM entitlement WHERE id = ? AND store = ?").run(Number(id), XBOX);
  // A Game exists only to hold Entitlements.
  db.exec("DELETE FROM game WHERE id NOT IN (SELECT game_id FROM entitlement WHERE game_id IS NOT NULL)");
}

// The Xbox storefront's own browse API, the one www.xbox.com calls: id, title
// and AUD price, unauthenticated. Play Anywhere is a server-side filter, so
// what comes back is exactly the catalogue an Xbox Entitlement can mean here
// (docs/adr/0002) — no console-only or cloud-only titles to sift out.
const BROWSE = "https://emerald.xboxservices.com/xboxcomfd/browse?locale=en-AU&market=AU&language=en";

// The filter is base64 of the shape the site's own client builds. A plain
// "PlayWith=XboxPlayAnywhere" is what the page URL shows and what the service
// answers with a 500.
const PLAY_ANYWHERE = Buffer.from(
  JSON.stringify({ PlayWith: { id: "PlayWith", choices: [{ id: "XboxPlayAnywhere" }] } }),
).toString("base64");

const cents = (n) => (Number.isFinite(n) ? Math.round(n * 100) : null);

// 25 a page is fixed — ItemCount and its spellings are all ignored — so the
// whole catalogue is about a hundred requests.
export async function syncCatalogue(db, { pages = 200 } = {}) {
  const byName = new Map();
  const ambiguous = new Set();
  let ct = null;

  for (let page = 0; page < pages; page++) {
    const res = await fetch(BROWSE, {
      method: "POST",
      // MS-CV is Microsoft's correlation vector: a request id, rejected when
      // absent but never checked for meaning.
      headers: {
        "content-type": "application/json",
        "x-ms-api-version": "1.1",
        "ms-cv": `${Math.random().toString(36).slice(2, 18)}.${page + 1}`,
      },
      body: JSON.stringify({
        ChannelKeyToBeUsedInResponse: "all",
        Filters: PLAY_ANYWHERE,
        ...(ct ? { EncodedCT: ct } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Xbox browse returned ${res.status} ${res.statusText}`);
    const json = await res.json();

    for (const p of Object.values(json.productSummaries ?? {})) {
      const key = normaliseTitle(p.title ?? "");
      if (!key) continue;
      if (byName.has(key) && byName.get(key).id !== p.productId) ambiguous.add(key);
      else byName.set(key, { id: p.productId, price: p.specificPrices?.purchaseable?.[0] });
    }

    ct = json.channels?.all?.encodedCT;
    // The continuation token carries the paging state in plain base64; HasMore
    // is the only end-of-catalogue signal the response gives.
    if (!ct || !JSON.parse(Buffer.from(ct, "base64").toString()).HasMore) break;
  }

  if (byName.size === 0) throw new Error("Xbox catalogue came back empty; keeping the previous one.");

  const now = new Date().toISOString();
  const app = db.prepare("INSERT OR REPLACE INTO xbox_app (norm_title, product_id) VALUES (?, ?)");
  const save = db.prepare(
    `INSERT OR REPLACE INTO catalogue_price
       (store, store_id, currency, final_cents, initial_cents, discount_percent, formatted, fetched_at)
       VALUES ('xbox', ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec("DELETE FROM xbox_app");
  db.exec("DELETE FROM catalogue_price WHERE store = 'xbox'");

  let stored = 0;
  let priced = 0;
  for (const [key, { id, price }] of byName) {
    if (ambiguous.has(key)) continue;
    app.run(key, id);
    stored++;
    const final = cents(price?.listPrice);
    save.run(
      id,
      price?.currency ?? null,
      final,
      cents(price?.msrp),
      // The service returns 19.999998 for a fifth off.
      price?.discountPercentage > 0 ? Math.round(price.discountPercentage) : null,
      final == null ? null : `A$${price.listPrice.toFixed(2)}`,
      now,
    );
    if (final != null) priced++;
  }
  return { products: byName.size, ambiguous: ambiguous.size, stored, priced };
}
