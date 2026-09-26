import { saveCredential, replaceAll } from "./db.js";
import { addEditions, normaliseTitle } from "./match.js";

// GOG Galaxy's own OAuth client. Publicly known and used by every third-party
// GOG tool; there is no way to register your own.
const CLIENT_ID = "46899977096215655";
const CLIENT_SECRET = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9";
const REDIRECT = "https://embed.gog.com/on_login_success?origin=client";

export const AUTH_URL =
  `https://auth.gog.com/auth?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&layout=client2`;

// The login lands on a URL with ?code=... — accept the whole thing pasted in,
// or just the code.
export const extractCode = (pasted) => {
  const s = pasted.trim();
  // Anchor on the query parameter: a bare /(code=)?(\w+)/ happily matches
  // "on_login_success" out of the redirect URL.
  return s.match(/[?&]code=([\w-]+)/)?.[1] ?? (/^[\w-]{10,}$/.test(s) ? s : null);
};

const expired = (err) => Object.assign(new Error(err), { reauth: true });

async function token(params) {
  const res = await fetch(
    `https://auth.gog.com/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&${params}`,
  );
  if (!res.ok) {
    throw expired(`GOG login failed (${res.status}). The code or session has expired — reconnect.`);
  }
  const json = await res.json();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

export const exchangeCode = (code) =>
  token(`grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT)}`);

// Access tokens last an hour, so a refresh on nearly every Sync is normal.
async function accessToken(db, data) {
  if (data.access_token && Date.parse(data.expires_at) > Date.now() + 60_000) return data.access_token;
  const fresh = await token(`grant_type=refresh_token&refresh_token=${encodeURIComponent(data.refresh_token)}`);
  saveCredential(db, "gog", fresh);
  return fresh.access_token;
}

export async function fetchOwnedGames(data, db) {
  const auth = { Authorization: `Bearer ${await accessToken(db, data)}` };
  const games = [];

  for (let page = 1; ; page++) {
    const res = await fetch(`https://embed.gog.com/account/getFilteredProducts?mediaType=1&page=${page}`, {
      headers: auth,
    });
    if (res.status === 401) throw expired("GOG rejected the token — reconnect.");
    if (!res.ok) throw new Error(`GOG returned ${res.status} ${res.statusText}`);

    const json = await res.json();
    for (const p of json.products ?? []) {
      games.push({ store_game_id: String(p.id), store_title: p.title });
    }
    if (page >= (json.totalPages ?? 1)) return games;
  }
}

// GOG's storefront catalogue: id, title and AUD price in one paginated sweep,
// unauthenticated. 100 per page is the ceiling — asking for more returns an
// error list rather than products.
const CATALOG = "https://catalog.gog.com/v1/catalog";

// "-90%" -> 90. GOG formats the discount for display; the number is what the
// sort and the "on sale" filter need.
const percent = (s) => {
  const n = Number.parseInt(String(s ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// "5.49" -> 549. Prices arrive as decimal strings, and cents keep them
// comparable with Steam's without floats getting involved.
const cents = (s) => {
  const n = Math.round(Number.parseFloat(s) * 100);
  return Number.isFinite(n) ? n : null;
};

// Packs are included because GOG sells some base games as one — "Cyberpunk
// 2077" is a pack of the game and its bonus content, not a game product.
//
// Like Steam's app list, a title claimed by more than one product is dropped —
// GOG sells editions, bundles and soundtracks under names that collide, and
// pricing the wrong one is worse than pricing nothing.
export async function syncCatalogue(db, { pages = 100 } = {}) {
  const byName = new Map();
  const ambiguous = new Set();

  for (let page = 1; page <= pages; page++) {
    const res = await fetch(
      `${CATALOG}?limit=100&page=${page}&countryCode=AU&locale=en-US&currencyCode=AUD&productType=in:game,pack`,
    );
    if (!res.ok) throw new Error(`GOG catalogue returned ${res.status} ${res.statusText}`);
    const json = await res.json();
    const products = json.products ?? [];
    if (products.length === 0) break;

    for (const p of products) {
      const key = normaliseTitle(p.title ?? "");
      if (!key) continue;
      if (byName.has(key) && byName.get(key).id !== String(p.id)) ambiguous.add(key);
      else byName.set(key, { id: String(p.id), price: p.price });
    }
    if (page >= (json.pages ?? 1)) break;
  }
  addEditions(byName, ambiguous);

  // A partial sweep must not erase what is already known, so the replace only
  // happens once every page has been fetched.
  if (byName.size === 0) throw new Error("GOG catalogue came back empty; keeping the previous one.");

  const now = new Date().toISOString();
  const app = db.prepare("INSERT OR REPLACE INTO gog_app (norm_title, product_id) VALUES (?, ?)");
  const save = db.prepare(
    `INSERT OR REPLACE INTO catalogue_price
       (store, store_id, currency, final_cents, initial_cents, discount_percent, formatted, fetched_at)
       VALUES ('gog', ?, ?, ?, ?, ?, ?, ?)`,
  );

  // The swap is one transaction: a page rendered between the DELETE and the
  // last insert would otherwise find no GOG prices at all.
  const [stored, priced] = replaceAll(db, () => {
    db.exec("DELETE FROM gog_app");
    db.exec("DELETE FROM catalogue_price WHERE store = 'gog'");

    let stored = 0;
    let priced = 0;
    for (const [key, { id, price }] of byName) {
      if (ambiguous.has(key)) continue;
      app.run(key, id);
      stored++;
      const final = cents(price?.finalMoney?.amount);
      save.run(
        id,
        price?.finalMoney?.currency ?? null,
        final,
        cents(price?.baseMoney?.amount),
        percent(price?.discount),
        price?.final ? `A${price.final}` : null,
        now,
      );
      if (final != null) priced++;
    }
    return [stored, priced];
  });

  return { products: byName.size, ambiguous: ambiguous.size, stored, priced };
}
