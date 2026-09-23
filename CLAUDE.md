# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
docker compose up            # the only supported way to run it (ADR-0004) — http://localhost:3000
node --test "src/*.test.js"  # all tests. `node --test src/` fails with MODULE_NOT_FOUND
node --test src/price.test.js                       # one file
node --test --test-name-pattern "on-sale filter" "src/*.test.js"   # one test
```

There is no `npm test`, no build, no linter, and **no npm dependencies at all** — Node 24 standard library only (`node:sqlite`, `node:http`, `node:test`, global `fetch`, template literals for views). Keep it that way; adding a dependency is a design decision, not a convenience.

Writing to `data/library.db` from the host while the container is up corrupts the container's view of it (`database disk image is malformed`). Use the app's own buttons, or `docker restart games-library-web-1` after a host-side write. A `PreToolUse` hook (`.claude/hooks/guard-library-db.sh`) denies the write while the container is up; reads still work through `sqlite3 "file:data/library.db?mode=ro"`.

## Domain language

`CONTEXT.md` defines the vocabulary — Game, Entitlement, Store, Sync, Connection, Play Anywhere, Unmatched Entitlement — with the words to avoid for each. Use these names in code, comments, commit messages and UI copy.

`docs/adr/` holds five decisions that most changes will touch. Read the relevant one before working against it:

- **0001** Games are inferred by matching Entitlements against IGDB, never reported by a Store.
- **0002** Xbox Entitlements are typed by hand, Play Anywhere only.
- **0003** GeForce NOW support belongs to an *Entitlement*, not a Game.
- **0004** Compose-only, every credential in SQLite, entered through the Connect page.
- **0005** Epic stays unpriced: Cloudflare means a browser, and a browser is not worth 2.2% of the catalogue.

## Architecture

**Entitlement → Game.** `sync.js` fetches a Store's Entitlements, upserts them with `game_id` left null, then hands over to `match.js` — which owns Game assignment, IGDB identification, artwork, genres and ratings, in that order. Each Store syncs alone: a failure marks that Store's credential and leaves every other Store untouched. Entitlements that stop appearing are never deleted.

**ADR-0003 governs anything per-store.** The `sells()` clause in `db.js` exists because of it: a price is only shown for a Store that GeForce NOW actually lists that title under. Without it a GOG sale badges a Steam-only title −95% next to Steam's full price — this happened. Any new per-store attribute needs the same treatment.

**Catalogue prices** are keyed by `(store, store_id)` in `catalogue_price`, with a per-store title→id table (`steam_app`, `gog_app`, `xbox_app`). All three resolvers follow the same rule: **a normalised title claimed by more than one product is dropped, not guessed** — editions, demos and soundtracks collide, and the wrong price is worse than no price. Each sweep collects everything in memory first and only replaces its rows once complete, so a partial fetch cannot erase what is known.

**Views are template literals** in `views.js`, no framework. State lives in the query string; a detail panel is its own URL (`?game=` on Library, `?title=` on Discover) so it is linkable and the back button closes it. `server.js` is a flat `"METHOD /path"` route table; POST handlers 303 back.

**Migrations** are an array in `db.js` tracked by `PRAGMA user_version`. **Append only** — inserting in the middle means an existing database skips the new one and breaks at runtime.

## Store endpoints

Every one of these was verified against the live service before being written down; none is documented by its vendor.

| Store | What works |
|---|---|
| Steam | `IStoreService/GetAppList` for ids, `appdetails?filters=price_overview` 100 appids at a time. Metacritic is one appid per request and rate limited to ~200 per 5 min, so misses are remembered permanently. |
| GOG | `catalog.gog.com/v1/catalog`, unauthenticated, 100/page. Galaxy's own public OAuth client for owned games. |
| Xbox | `emerald.xboxservices.com/xboxcomfd/browse`, unauthenticated, 25/page. `Filters` must be **base64 of the JSON filter map** (the `PlayWith=XboxPlayAnywhere` in the page URL returns a 500), an **MS-CV header is mandatory** but never validated, and discounts arrive as `19.999998`. |
| Epic | Owned games only. Prices are unreachable: `store.epicgames.com/graphql` and the browse page are both **Cloudflare 403** to anything but a real browser, and the authenticated catalog service returns a list price with **no discount field anywhere**. ADR-0005 has the full table of what was tried. |
| GeForce NOW | Pentanet's `cloud.gg/api/games/list/{page}/{size}` — **zero-indexed**, page 1 silently drops the first 100 games. NVIDIA's static list is not a complete catalogue and is fetched only for the Steam appids it carries. |

## Testing

Tests stub global `fetch` and use `open(":memory:")`; there are no fixtures on disk and no test framework beyond `node:test`. Test names are sentences stating the rule being defended ("a price is hidden for a store GeForce NOW does not list the title under"), and the ones guarding an ADR say which.

## Design

`design_handoff_games_library/` is the Nocturne redesign reference — read it for exact spacing and colour values, but it is a prototype in a proprietary component format and must not be ported literally. `static/nocturne.css` is the design system; the two signals it insists on are store ownership on every row and GeForce NOW as the one green accent.
