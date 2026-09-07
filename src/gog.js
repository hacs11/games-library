import { saveCredential } from "./db.js";

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
