import { test } from "node:test";
import assert from "node:assert/strict";
import { open, unmatched } from "./db.js";
import { addTitles, list, count, remove, XBOX } from "./xbox.js";
import { matchEntitlements } from "./match.js";
import { identify } from "./igdb.js";

test("pasting is forgiving: blanks dropped, whitespace trimmed, repeats ignored", () => {
  const db = open(":memory:");
  const first = addTitles(db, "Halo Infinite\n  Forza Horizon 5  \n\n   \nStarfield");
  assert.deepEqual([first.pasted, first.added], [3, 3]);

  // Pasting the whole list again, as anyone re-copying their library would.
  const second = addTitles(db, "Halo Infinite\nForza Horizon 5\nStarfield\nDoom Eternal");
  assert.equal(second.added, 1, "only the new title is added");
  assert.equal(count(db), 4);
  assert.deepEqual(list(db).map((r) => r.store_title).sort(), [
    "Doom Eternal",
    "Forza Horizon 5",
    "Halo Infinite",
    "Starfield",
  ]);
});

test("the same game typed differently is still one Entitlement", () => {
  const db = open(":memory:");
  addTitles(db, "HALO INFINITE");
  addTitles(db, "Halo Infinite!");
  assert.equal(count(db), 1, "the normalised title is the id");
});

// There is no Sync to correct a typo with, so removal has to exist.
test("removing an Xbox Entitlement takes its orphaned Game with it", async () => {
  const db = open(":memory:");
  addTitles(db, "Halo Infinite");
  await matchEntitlements(db, XBOX, async () => new Map(), async () => new Map());
  assert.equal(db.prepare("SELECT count(*) c FROM game").get().c, 1);

  remove(db, list(db)[0].id);
  assert.equal(count(db), 0);
  assert.equal(db.prepare("SELECT count(*) c FROM game").get().c, 0, "no Game left holding nothing");
});

// Xbox carries no store id, which is a known absence — not the silent-empty
// failure that once buried a whole library in the review tray.
test("a Store with no IGDB source is identified by title without erroring", async () => {
  const db = open(":memory:");
  addTitles(db, "Halo Infinite");
  assert.deepEqual([...(await identify(db, XBOX, ["halo-infinite"]))], []);

  const result = await matchEntitlements(
    db,
    XBOX,
    identify,
    async () => new Map([["halo infinite", { igdb_id: 1, title: "Halo Infinite" }]]),
  );
  assert.deepEqual([result.igdb, result.named], [0, 1]);
  assert.equal(unmatched(db).length, 0);
});
