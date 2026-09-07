// Cheap fallback identity: two Entitlements whose titles normalise the same are
// the same Game. IGDB replaces this as the primary matcher in slice 3; this
// stays as the fallback for anything IGDB cannot identify.
export function normaliseTitle(title) {
  return title
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveGame(db, title) {
  const norm = normaliseTitle(title);
  // norm_title is deliberately not unique: IGDB can hold two distinct works
  // whose titles normalise identically. First match wins for clustering.
  const found = db.prepare("SELECT id FROM game WHERE norm_title = ? ORDER BY id LIMIT 1").get(norm);
  if (found) return found.id;
  return db
    .prepare("INSERT INTO game (title, norm_title) VALUES (?, ?) RETURNING id")
    .get(title, norm).id;
}

// Store junk: demos, soundtracks, editors and the like. These words are only
// ever suffixes on store artifacts, never on a real game's title.
const NON_GAME = /\b(demo|soundtrack|ost|playtest|beta|pre-?game editor|editor|dedicated server|sdk|artbook|art book|wallpapers?|season pass|trailer|bonus content|test server)\b/i;

// IGDB first, title clustering for whatever it cannot identify. Anything not
// resolved by IGDB is flagged for review rather than merged silently.
export async function matchEntitlements(db, store, identify, identifyByName = null) {
  const rows = db
    .prepare("SELECT id, store_game_id, alt_id, store_title FROM entitlement WHERE store = ? AND locked = 0")
    .all(store);
  if (rows.length === 0) return { igdb: 0, fallback: 0 };

  let found = new Map();
  try {
    // Epic Entitlements carry two candidate ids and IGDB indexes only one of
    // them; ask about both rather than guessing which.
    found = await identify(db, store, [
      ...new Set(rows.flatMap((r) => [r.store_game_id, r.alt_id]).filter(Boolean)),
    ]);
  } catch (err) {
    // IGDB being down must not stop a Sync — everything falls back to titles.
    // The failure is recorded against IGDB so the Connect page shows it,
    // rather than only appearing as an inexplicably full review tray.
    console.error(`IGDB lookup failed for ${store}: ${err.message}`);
    db.prepare("UPDATE store_credential SET status = 'error', last_error = ? WHERE store = 'igdb'")
      .run(`${store}: ${err.message}`);
  }

  // Stores whose ids IGDB does not index (Epic) get a second pass against
  // IGDB's own titles, so they still land on the same Game as Steam and GOG.
  let byName = new Map();
  const missed = rows.filter((r) => !found.get(String(r.store_game_id)) && !(r.alt_id && found.get(String(r.alt_id))));
  if (identifyByName && missed.length > 0) {
    try {
      byName = await identifyByName(db, missed.map((r) => r.store_title), normaliseTitle);
    } catch (err) {
      console.error(`IGDB name lookup failed for ${store}: ${err.message}`);
    }
  }

  const byIgdb = db.prepare(
    `INSERT INTO game (igdb_id, title, norm_title) VALUES (?, ?, ?)
       ON CONFLICT (igdb_id) DO UPDATE SET title = excluded.title RETURNING id`,
  );
  const assign = db.prepare("UPDATE entitlement SET game_id = ?, confidence = ? WHERE id = ?");

  if (found.size > 0) {
    db.prepare("UPDATE store_credential SET status = 'connected', last_error = NULL WHERE store = 'igdb'").run();
  }

  let igdb = 0;
  let named = 0;
  let fallback = 0;
  for (const row of rows) {
    // "Football Manager 2024 Pre-game editor" name-matches Football Manager
    // 2024 and would then sit on the list page pretending to be the game
    // itself. Junk keeps its own Game, which classifyGames then hides.
    const junk = NON_GAME.test(row.store_title);
    const byId = junk ? null : found.get(String(row.store_game_id)) ?? (row.alt_id && found.get(String(row.alt_id)));
    const hit = byId || (junk ? null : byName.get(normaliseTitle(row.store_title)));
    if (hit) {
      assign.run(
        byIgdb.get(hit.igdb_id, hit.title, normaliseTitle(hit.title)).id,
        byId ? "igdb" : "igdb_name",
        row.id,
      );
      byId ? igdb++ : named++;
    } else {
      assign.run(resolveGame(db, row.store_title), "title", row.id);
      fallback++;
    }
  }
  // A Game exists only to hold Entitlements; re-matching can leave one behind.
  db.exec("DELETE FROM game WHERE id NOT IN (SELECT game_id FROM entitlement WHERE game_id IS NOT NULL)");

  return { igdb, named, fallback };
}

// Merge one Game into another: an explicit decision, so the moved Entitlements
// are locked and no later Sync can split them apart again.
export function mergeGames(db, fromId, intoId) {
  if (!fromId || !intoId || Number(fromId) === Number(intoId)) return false;
  const into = db.prepare("SELECT id FROM game WHERE id = ?").get(Number(intoId));
  if (!into) return false;

  // Both sides are locked, not just the ones that moved: leaving the target
  // unlocked lets a later match reassign it and split the pair from the other
  // end, stranding the Entitlements that were moved onto it.
  db.prepare("UPDATE entitlement SET game_id = ?, locked = 1, confidence = 'manual' WHERE game_id IN (?, ?)")
    .run(Number(intoId), Number(fromId), Number(intoId));
  db.exec("DELETE FROM game WHERE id NOT IN (SELECT game_id FROM entitlement WHERE game_id IS NOT NULL)");
  return true;
}

// Deliberately narrow: only things that cannot be launched at all are hidden.
// Expansions and mods stay visible — Dawn of War II: Retribution and Darkest
// Hour are games you sit down and play, whatever IGDB files them under. What
// gets hidden is DLC, addon packs, patch entries and forks.
const HIDDEN_TYPES = new Set([1, 13, 14, 12]);

export async function classifyGames(db, fetchTypes) {
  const identified = db.prepare("SELECT id, igdb_id FROM game WHERE igdb_id IS NOT NULL").all();

  let types = new Map();
  if (identified.length > 0) {
    try {
      types = await fetchTypes(db, identified.map((g) => g.igdb_id));
    } catch (err) {
      // Leave everything visible rather than hide things on a failed lookup.
      console.error(`IGDB game_type lookup failed: ${err.message}`);
      return { hidden: 0 };
    }
  }

  const set = db.prepare("UPDATE game SET is_game = ? WHERE id = ?");
  let hidden = 0;
  for (const g of identified) {
    const type = types.get(g.igdb_id);
    const playable = type === undefined || !HIDDEN_TYPES.has(type);
    set.run(playable ? 1 : 0, g.id);
    if (!playable) hidden++;
  }

  // Unidentified Games fall back to the title, matched against the store title
  // as well: IGDB-canonical titles rarely carry the junk suffix that gives it away.
  for (const g of db.prepare("SELECT id, title FROM game WHERE igdb_id IS NULL").all()) {
    const titles = db
      .prepare("SELECT store_title FROM entitlement WHERE game_id = ?")
      .all(g.id)
      .map((r) => r.store_title);
    const junk = [g.title, ...titles].some((t) => NON_GAME.test(t));
    set.run(junk ? 0 : 1, g.id);
    if (junk) hidden++;
  }

  return { hidden };
}

// Cover art and genres: IGDB where the Game is identified, the GeForce NOW
// catalogue as a fallback for the rest — it carries key art and genres for
// every game in it, which covers a good share of what IGDB missed.
export async function enrichGames(db, fetchArtwork) {
  const identified = db.prepare("SELECT id, igdb_id FROM game WHERE igdb_id IS NOT NULL").all();

  if (identified.length > 0) {
    try {
      const art = await fetchArtwork(db, identified.map((g) => g.igdb_id));
      const set = db.prepare("UPDATE game SET cover_url = ?, genres = ? WHERE id = ?");
      for (const g of identified) {
        const hit = art.get(g.igdb_id);
        if (hit) set.run(hit.cover_url, hit.genres, g.id);
      }
    } catch (err) {
      // Art is decoration; a failure here must not fail a Sync.
      console.error(`IGDB artwork lookup failed: ${err.message}`);
    }
  }

  db.exec(`
    UPDATE game SET
      cover_url = coalesce(cover_url, (SELECT image_url FROM gfn_entry WHERE norm_title = game.norm_title AND image_url IS NOT NULL LIMIT 1)),
      genres    = coalesce(genres,    (SELECT genres    FROM gfn_entry WHERE norm_title = game.norm_title AND genres    IS NOT NULL LIMIT 1))
    WHERE cover_url IS NULL OR genres IS NULL
  `);

  return db.prepare("SELECT count(*) c FROM game WHERE cover_url IS NOT NULL").get().c;
}
