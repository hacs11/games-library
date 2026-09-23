// gg.deals aggregates prices across 60+ stores and keyshops, keyed by Steam
// appid. Its free tier names no store, so what comes back is a Market Low — a
// cheapest-anywhere figure that sits beside the per-store prices and is never
// one of them (docs/adr/0006). The documented host `gg.deals/api/...` is a
// Cloudflare 403 to anything but a browser; `api.gg.deals` answers plain JSON.
const PRICES = "https://api.gg.deals/v1/prices/by-steam-app-id/";

// Prices arrive as decimal strings ("91.99", or null), and every other price
// in the database is cents.
const cents = (s) => (s == null || s === "" ? null : Math.round(Number(s) * 100));

// Every appid the Discover catalogue can be reached by: the title→appid table
// first, then the appid GeForce NOW's own NVIDIA rows carry, which is the only
// id a title the Steam resolver dropped as ambiguous still has. Deliberately
// not gated by sells() — a Market Low belongs to the Game, not to a Store, so
// an Epic-only or Ubisoft-only title is asked for just the same.
const APPIDS = `SELECT DISTINCT coalesce(a.appid, n.steam_appid) AS appid
         FROM gfn_entry g
         LEFT JOIN steam_app a ON a.norm_title = g.norm_title
         LEFT JOIN gfn_entry n ON n.norm_title = g.norm_title AND n.steam_appid IS NOT NULL
        WHERE coalesce(a.appid, n.steam_appid) IS NOT NULL`;

export const pendingCount = (db) => db.prepare(`SELECT count(*) c FROM (${APPIDS})`).get().c;

// 100 appids per request, so the whole catalogue is about two dozen requests.
export async function fetchMarketLows(db, { key, region = "au" }, { delay = 1200 } = {}) {
  const appids = db.prepare(APPIDS).all().map((r) => r.appid);

  const save = db.prepare(
    `INSERT OR REPLACE INTO market_low
       (appid, currency, retail_cents, keyshop_cents, retail_low_cents, keyshop_low_cents, title, url, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = new Date().toISOString();
  let priced = 0;
  for (let i = 0; i < appids.length; i += 100) {
    const batch = appids.slice(i, i + 100);
    if (i > 0) await new Promise((r) => setTimeout(r, delay));

    const res = await fetch(
      `${PRICES}?ids=${batch.join(",")}&key=${encodeURIComponent(key)}&region=${encodeURIComponent(region)}`,
    );
    // Every request here carries the same key to the same host, so a failure is
    // not a flaky batch — it is the whole sweep, and it should say so. A 429 is
    // the exception: keep what landed and let the next press pick up the rest.
    if (res.status === 429) break;
    if (!res.ok) throw new Error(`gg.deals returned ${res.status} ${res.statusText}`);

    const { data } = await res.json().catch(() => ({}));
    for (const appid of batch) {
      // A null entry means gg.deals does not know the appid. It is recorded as
      // a row of nulls all the same, so the answer is not re-asked blind.
      const p = data?.[appid]?.prices;
      save.run(
        appid,
        p?.currency ?? null,
        cents(p?.currentRetail),
        cents(p?.currentKeyshops),
        cents(p?.historicalRetail),
        cents(p?.historicalKeyshops),
        data?.[appid]?.title ?? null,
        data?.[appid]?.url ?? null,
        now,
      );
      if (p?.currentRetail != null || p?.currentKeyshops != null) priced++;
    }
  }
  return { asked: appids.length, priced };
}
