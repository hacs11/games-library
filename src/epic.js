import { saveCredential } from "./db.js";

// The Epic Games Launcher's own OAuth client, as used by legendary. There is
// no way to register your own.
const CLIENT_ID = "34a02cf8f4414e29b15921876da36f9a";
const CLIENT_SECRET = "daafbccc737745039dffe53d94fc76cf";
const BASIC = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
const UA = "UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit";

const OAUTH = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";
const LAUNCHER = "https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public";
const CATALOG = "https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared";

export const AUTH_URL =
  "https://www.epicgames.com/id/login?redirectUrl=" +
  encodeURIComponent(`https://www.epicgames.com/id/api/redirect?clientId=${CLIENT_ID}&responseType=code`);

// The redirect page shows a JSON blob; accept the whole paste or a bare code.
export const extractCode = (pasted) => {
  const s = pasted.trim();
  return s.match(/"authorizationCode"\s*:\s*"([\w-]+)"/)?.[1] ?? (/^[\w-]{20,}$/.test(s) ? s : null);
};

const expired = (msg) => Object.assign(new Error(msg), { reauth: true });

async function token(params) {
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: {
      Authorization: `basic ${BASIC}`,
      "User-Agent": UA,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...params, token_type: "eg1" }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errorCode) {
    throw expired(`Epic login failed: ${json.errorMessage ?? res.status}. Reconnect.`);
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

export const exchangeCode = (code) => token({ grant_type: "authorization_code", code });

// Epic's refresh tokens expire for good after a while, unlike GOG's — this is
// the Store that will genuinely need re-connecting every so often.
async function accessToken(db, data) {
  if (data.access_token && Date.parse(data.expires_at) > Date.now() + 60_000) return data.access_token;
  if (!data.refresh_token) throw expired("Epic login has expired. Reconnect.");
  const fresh = await token({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  saveCredential(db, "epic", fresh);
  return fresh.access_token;
}

const get = async (url, access) => {
  const res = await fetch(url, { headers: { Authorization: `bearer ${access}`, "User-Agent": UA } });
  if (res.status === 401) throw expired("Epic rejected the token. Reconnect.");
  if (!res.ok) throw new Error(`Epic returned ${res.status} ${res.statusText}`);
  return res.json();
};

const chunk = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function fetchOwnedGames(data, db) {
  const access = await accessToken(db, data);

  // The asset list is ids only, and includes Unreal Engine content, plugins
  // and DLC alongside actual games. Titles and categories come from the
  // catalog, which is the only thing that can tell them apart.
  const assets = (await get(`${LAUNCHER}/assets/Windows?label=Live`, access)).filter(
    (a) => a.namespace !== "ue",
  );

  const byNamespace = new Map();
  for (const a of assets) {
    if (!byNamespace.has(a.namespace)) byNamespace.set(a.namespace, []);
    byNamespace.get(a.namespace).push(a);
  }

  const games = [];
  for (const [namespace, items] of byNamespace) {
    for (const batch of chunk(items, 30)) {
      const ids = batch.map((i) => `id=${encodeURIComponent(i.catalogItemId)}`).join("&");
      const info = await get(
        `${CATALOG}/namespace/${namespace}/bulk/items?${ids}&country=AU&locale=en-AU&includeMainGameDetails=true`,
        access,
      );
      for (const item of batch) {
        const meta = info[item.catalogItemId];
        // Keep only base games: `mainGameItem` marks DLC, and anything not
        // categorised as a game is a plugin, engine asset or the launcher.
        if (!meta || meta.mainGameItem) continue;
        if (!meta.categories?.some((c) => c.path === "games")) continue;
        games.push({
          store_game_id: item.catalogItemId,
          alt_id: namespace,
          store_title: meta.title,
        });
      }
    }
  }
  return games;
}
