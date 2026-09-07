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
    const byId = found.get(String(row.store_game_id)) ?? (row.alt_id && found.get(String(row.alt_id)));
    const hit = byId || byName.get(normaliseTitle(row.store_title));
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
