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
  const found = db.prepare("SELECT id FROM game WHERE norm_title = ?").get(norm);
  if (found) return found.id;
  return db
    .prepare("INSERT INTO game (title, norm_title) VALUES (?, ?) RETURNING id")
    .get(title, norm).id;
}
