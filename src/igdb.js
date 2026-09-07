import { credential, saveCredential } from "./db.js";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API = "https://api.igdb.com/v4";

// IGDB's own display names, resolved to ids at runtime: the older `category`
// field is already deprecated, so hardcoded numbers are a liability. Note these
// are the names external_game_sources returns ("Epic Games Store"), NOT the
// snake_case spellings of the deprecated enum ("epic_game_store").
export const IGDB_SOURCE = { steam: "Steam", gog: "GOG", epic: "Epic Games Store" };

async function token(db) {
  const cred = credential(db, "igdb");
  if (!cred?.data?.client_id) throw new Error("IGDB is not connected");
  const { client_id, client_secret, access_token, expires_at } = cred.data;
  if (access_token && Date.parse(expires_at) > Date.now() + 60_000) return access_token;

  const res = await fetch(
    `${TOKEN_URL}?client_id=${encodeURIComponent(client_id)}&client_secret=${encodeURIComponent(client_secret)}&grant_type=client_credentials`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`IGDB auth failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  saveCredential(db, "igdb", {
    client_id,
    client_secret,
    access_token: json.access_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  });
  return json.access_token;
}

export async function query(db, endpoint, apicalypse) {
  const cred = credential(db, "igdb");
  if (!cred?.data?.client_id) throw new Error("IGDB is not connected");
  const { client_id } = cred.data;
  const res = await fetch(`${API}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": client_id,
      Authorization: `Bearer ${await token(db)}`,
      Accept: "application/json",
    },
    body: apicalypse,
  });
  if (!res.ok) throw new Error(`IGDB ${endpoint} returned ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function sourceIds(db) {
  const rows = await query(db, "external_game_sources", "fields id,name; limit 100;");
  return Object.fromEntries(rows.map((r) => [r.name, r.id]));
}

const chunk = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const pause = () => new Promise((r) => setTimeout(r, 260)); // IGDB allows 4 req/sec

// store uid -> { igdb_id, title } for everything IGDB recognises.
export async function identify(db, store, uids) {
  // Xbox Entitlements are typed by hand and carry no store id at all, so there
  // is nothing to look up. This is a known absence, not the silent-empty bug
  // below: those Entitlements are identified by title instead.
  if (!IGDB_SOURCE[store]) return new Map();

  const sources = await sourceIds(db);
  const wanted = IGDB_SOURCE[store].toLowerCase();
  const name = Object.keys(sources).find((n) => n.toLowerCase() === wanted);
  // Never return an empty result here: an unknown source is a configuration
  // bug, and silently falling back to title matching hides it behind a tray
  // full of games that IGDB could have identified perfectly well.
  if (!name) {
    throw new Error(
      `IGDB has no external game source named "${IGDB_SOURCE[store]}". It offers: ${Object.keys(sources).join(", ")}`,
    );
  }
  const sourceId = sources[name];

  const found = new Map();
  for (const batch of chunk(uids, 200)) {
    const list = batch.map((u) => `"${String(u).replace(/"/g, "")}"`).join(",");
    const rows = await query(
      db,
      "external_games",
      `fields uid,game.id,game.name; where external_game_source = ${sourceId} & uid = (${list}); limit 500;`,
    );
    for (const r of rows) {
      if (r.game?.id) found.set(String(r.uid), { igdb_id: r.game.id, title: r.game.name });
    }
    await pause();
  }
  return found;
}

// Fallback identity for Stores whose ids IGDB does not index (Epic): look the
// title up in IGDB's own catalogue. Only an unambiguous hit counts — if two
// IGDB games share a normalised name, we cannot tell which you own, so the
// Entitlement is left to title clustering instead of guessed at.
export async function identifyByName(db, titles, normalise) {
  const wanted = new Map(titles.map((t) => [normalise(t), t]));
  const found = await lookupNames(db, [...wanted.values()], wanted, normalise, "games", "id,name", (r) => r);

  // Stores name games differently from IGDB: Epic sells "Fallout 2: A Post
  // Nuclear Role Playing Game", which IGDB records as an alternative name for
  // "Fallout 2". Without this, that copy never joins the Game its GOG and
  // Steam copies already share.
  const missing = [...wanted.entries()].filter(([key]) => !found.has(key));
  if (missing.length > 0) {
    const aliases = await lookupNames(
      db,
      missing.map(([, title]) => title),
      new Map(missing),
      normalise,
      "alternative_names",
      "name,game.id,game.name",
      (r) => (r.game?.id ? { id: r.game.id, name: r.game.name, matched: r.name } : null),
    );
    for (const [key, hit] of aliases) found.set(key, hit);
  }

  return found;
}

// Exact-name lookup against one IGDB endpoint. An ambiguous name — two games
// answering to it — is dropped rather than guessed at.
async function lookupNames(db, titles, wanted, normalise, endpoint, fields, pick) {
  const found = new Map();
  const counts = new Map();

  for (const batch of chunk(titles, 100)) {
    const list = batch.map((t) => `"${t.replace(/["\\]/g, "")}"`).join(",");
    const rows = await query(db, endpoint, `fields ${fields}; where name = (${list}); limit 500;`);
    for (const row of rows) {
      const hit = pick(row);
      if (!hit) continue;
      // Match on the name we searched for, which for an alias is not the
      // game's own name.
      const key = normalise(hit.matched ?? hit.name);
      if (!wanted.has(key)) continue;
      if (found.get(key)?.igdb_id !== hit.id) counts.set(key, (counts.get(key) ?? 0) + 1);
      found.set(key, { igdb_id: hit.id, title: hit.name });
    }
    await pause();
  }

  for (const [key, n] of counts) if (n > 1) found.delete(key);
  return found;
}

// IGDB's game_type for each id. `category` is deprecated and no longer
// returned; game_type carries the same values (0 = Main Game, 1 = DLC, …).
export async function gameTypes(db, igdbIds) {
  const types = new Map();
  for (const batch of chunk(igdbIds, 300)) {
    const rows = await query(db, "games", `fields id,game_type; where id = (${batch.join(",")}); limit 500;`);
    for (const r of rows) types.set(r.id, r.game_type ?? 0);
    await pause();
  }
  return types;
}

// Cover art and genres. Covers are served from IGDB's own image CDN; t_cover_big
// is 264x374, which stays sharp on a retina display at list-thumbnail size.
export async function artwork(db, igdbIds) {
  const art = new Map();
  for (const batch of chunk(igdbIds, 300)) {
    const rows = await query(
      db,
      "games",
      `fields id,cover.image_id,genres.name; where id = (${batch.join(",")}); limit 500;`,
    );
    for (const r of rows) {
      art.set(r.id, {
        cover_url: r.cover?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${r.cover.image_id}.jpg`
          : null,
        genres: (r.genres ?? []).map((g) => g.name).join(", ") || null,
      });
    }
    await pause();
  }
  return art;
}

// IGDB's own aggregation of critic scores — related to Metacritic but not the
// same number, and sometimes built from very few reviews, so the count is kept
// to let the UI say how thin a score is.
export async function criticScores(db, igdbIds) {
  const scores = new Map();
  for (const batch of chunk(igdbIds, 300)) {
    const rows = await query(
      db,
      "games",
      `fields id,aggregated_rating,aggregated_rating_count; where id = (${batch.join(",")}) & aggregated_rating != null; limit 500;`,
    );
    for (const r of rows) {
      scores.set(r.id, { score: Math.round(r.aggregated_rating), count: r.aggregated_rating_count ?? 0 });
    }
    await pause();
  }
  return scores;
}
