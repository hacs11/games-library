# Handoff: Games Library redesign

## Overview

A modernization of an existing personal games-library site (614 owned titles across Steam, Epic, GOG and Xbox). The redesign covers all five pages of the app — **Library, Unmatched, Discover, Xbox, Connect** — on the Nocturne dark design system.

The two jobs the owner does most often drove the design:

1. **Checking which store a game is on** — store ownership is visible on every tile/row, not hidden behind a click.
2. **Checking GeForce NOW streamability** — GFN is a distinct green signal (the only non-system colour in the design), visible in the grid, in rows, in filters and in the detail panel.

`before-current-site.png` in this folder is the current production UI for reference.

## About the design files

The files in this bundle are **design references created in HTML** — a prototype showing intended look and behaviour. They are **not production code to copy**. `Games Library.dc.html` is authored in a proprietary streaming-component format (`<x-dc>` + a `Component extends DCLogic` class); it will not run in your codebase and should not be ported literally.

The task is to **recreate these designs in the target codebase's existing environment** using its established patterns, component library and routing. If no frontend environment exists yet, pick the appropriate framework for the project (the existing app appears to be a server-rendered site — a light setup such as templates + a small amount of client JS, or React/Vue if already planned, is fine) and implement the designs there.

Read the HTML for exact markup structure, spacing and colour values — every value is inline and explicit.

## Fidelity

**High fidelity.** Final colours, typography, spacing, radii, hover/active states and interaction behaviour are all decided. Recreate the UI faithfully using your codebase's own components where equivalents exist.

Two deliberate exceptions, both requiring real assets to finish:

- **Cover art is placeholder.** Every cover is a monogram tile (game initials on `--color-surface` with the word "cover" in the corner). In production these must be real cover images from your metadata provider, at 3:4 aspect ratio, `border-radius: 8px`, `object-fit: cover`. Keep the monogram tile as the fallback for missing art (the current site shows an empty grey box — the monogram is the intended replacement).
- **Store marks are neutral letter monograms** (`S`, `E`, `G`, `X`) in `--color-accent-400`, not the real brand logos. Substitute the official Steam / Epic Games / GOG / Xbox SVG marks, sized 12–14px, at the same positions. A design toggle exists for "logo only" vs "logo + name" — **ship "logo + name"** (the owner's chosen setting).

## Design system

Nocturne, a compact dark system. `nocturne-styles.css` in this folder is the source of truth — **link it or port its `:root` token block; do not re-derive values by eye.** `nocturne-readme.md` is the written guide.

Key rules that shape this design:

- Dark ground `#161826`, surfaces `#232532`, text `#e9e9ed`, single accent `#9184d9`.
- Buttons are **outlined, never filled**. Primary = 1px accent border on transparent.
- Headings stay at weight 500. Hierarchy is size and space, not boldness.
- **Free-standing horizontal rules fade to transparent** over the first and last 48px:
  `linear-gradient(to right, transparent, var(--color-divider) 48px, var(--color-divider) calc(100% - 48px), transparent)`. This applies to the header underline and the filter-bar divider. Box outlines and in-control separators stay solid.
- Accent is used as a line, a mark and a glow — never as a large fill.
- Elevation is `--shadow-sm/md/lg` only; no ad-hoc box-shadows.
- Icons are [Phosphor](https://phosphoricons.com) (regular weight), inline SVG on `currentColor`. Icons used here: `magnifying-glass`, `lightning`, `squares-four`, `list`, `x`.

### Design tokens

Colours (from `nocturne-styles.css`):

| Token | Value | Used for |
| --- | --- | --- |
| `--color-bg` | `#161826` | page ground, detail-panel inner tiles |
| `--color-surface` | `#232532` | cards, cover tiles, detail panel |
| `--color-text` | `#e9e9ed` | body text |
| `--color-accent` | `#9184d9` | active nav, outlined primary buttons, focus ring |
| `--color-accent-400` | `#b5abfc` | store monogram marks |
| `--color-accent-300` | `#d2cefd` | accent text at paragraph size |
| `--color-accent-900` | `#2b2741` | active nav pill background |
| `--color-neutral-300` | `#cfd3e5` | store-pill text, score text |
| `--color-neutral-400` | `#b2b6ca` | table secondary values |
| `--color-neutral-700` | `#595d6c` | cover-tile monogram |
| `--color-neutral-800` | `#3f424d` | pill hairline (`inset 0 0 0 1px`) |
| `--color-neutral-900` | `#292b31` | store-pill background |
| `--color-divider` | `color-mix(in srgb, #e9e9ed 16%, transparent)` | rules, input borders |

GFN green — **the one colour outside the system**, added at the owner's request so streamability reads at a glance:

| Purpose | Value |
| --- | --- |
| GFN text / icon | `#a3d95a` |
| GFN pill + active-filter background | `#1d2a14` |
| GFN pill hairline | `#3f5c22` |
| GFN active-filter border | `#5d8a2c` |

Muted text is `color-mix(in srgb, var(--color-text) N%, transparent)` — 45% for tertiary metadata, 50–55% for page intro copy, 60–72% for secondary text and inactive nav.

Spacing: `--space-1` 2.8px · `--space-2` 5.6px · `--space-3` 8.4px · `--space-4` 11.2px · `--space-6` 16.8px · `--space-8` 22.4px (0.70× density — the system is dense on purpose).

Radii: `--radius-sm` 4px · `--radius-md` 8px · `--radius-lg` 14px. Small pills/badges use 6px, thumbnails 5px.

Type: Inter throughout (400 body, 500 headings, 600 for monogram marks only). Body 15px/1.55. `h1` 42px system default — **overridden to 34px, `letter-spacing: -0.02em`** on every page title here. `h4` 20px, `h6` 13px uppercase `letter-spacing: 0.08em` (used for detail-panel section labels).

Shadows: `--shadow-sm: 0 0 0 1px #3f424d` · `--shadow-md: 0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55)` · `--shadow-lg: 0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65)`.

## Global chrome

**Header** — sticky, `top: 0`, `z-index: 20`. Padding `14px 28px`. Background `color-mix(in srgb, var(--color-bg) 88%, transparent)` with `backdrop-filter: blur(10px)`. Bottom edge is the 1px fading rule (see above), painted as a background layer.

- Left: brand lockup — a 22×22px rounded-6px square, 1px `--color-accent` border, containing "GL" at 11px/600 in accent; then "Games Library" at 16px, font-weight 500, `letter-spacing: -0.01em`. `margin-right: auto`.
- Right: five nav buttons — 13px, padding `6px 11px`, `border-radius: 8px`, `gap: 4px`. Inactive `color: color-mix(in srgb, var(--color-text) 72%, transparent)` on transparent. Active `color: var(--color-accent)`, background `var(--color-accent-900)`.

**Page container** — `padding: 0 28px`; `max-width` varies by page: Library and Discover 1240px, Unmatched and Xbox 1000px, Connect 780px. Page body has `padding-bottom: 64px`.

**Page title block** — `padding: 34px 0 20px`; `h1` at 34px. Library puts the count beside the title (13px, 50% muted, `padding-bottom: 6px`, baseline-aligned via `align-items: flex-end`). Other pages put a one-line intro paragraph under the title (14px, 55% muted, `max-width: 52–56ch`, `margin-top: 10px`).

## Screens

### 1. Library (default route)

The main view. Title "Library" + count label `"{filtered} of 614 titles"`.

**Filter bar** — one wrapping flex row, `gap: 10px`, `padding-bottom: 14px`, then the fading 1px rule with `margin-bottom: 22px`.

Controls, in order:

1. **Search** — `.input` in a relative wrapper, `flex: 1 1 240px`, `min-width: 200px`, `max-width: 320px`. Phosphor `magnifying-glass` 15px at `left: 10px; top: 11px; opacity: 0.45`; input gets `padding-left: 31px`. Placeholder "Search titles". Filters on substring match of title, case-insensitive.
2. **Store select** — `.input`, `min-width: 132px`, `appearance: none`, `padding-right: 26px`. Options: All stores / Steam / Epic Games / GOG / Xbox.
3. **Genre select** — `min-width: 140px`. "All genres" plus the genre list; populate from real data.
4. **Sort select** — `min-width: 124px`. A–Z (default) / Highest score / Recently added (by year desc, then title).
5. **GeForce NOW only** — a toggle button, `.btn` geometry, with the Phosphor `lightning` icon at 14px and the label "GeForce NOW only". Off: `border-color: var(--color-divider)`, `color: 75% muted`, transparent background. On: border `#5d8a2c`, text `#a3d95a`, background `#1d2a14`.
6. **Score range** — inline label `"Score ≥ {value|any}"` at 12px/62% muted plus a native `range` input, `min 0 max 95 step 5`, width 92px, `accent-color: var(--color-accent)`. `0` means no filter.
7. **View toggle** — `.seg` segmented control pushed right with `margin-left: auto`. Two buttons, "Grid" (`squares-four` icon) and "Rows" (`list` icon), 13px, padding `7px 12px`, 6px icon gap; the Rows button carries `border-left: 1px solid var(--color-divider)`. Selected option: `color: var(--color-accent)` + `box-shadow: inset 0 0 0 1px var(--color-accent)`. **Grid is the default.** Persist the choice per user.

All filters compose (AND). Empty result shows a centred message, "No titles match those filters.", `padding: 70px 0`, 14px, 45% muted.

**Grid view** — `display: grid; grid-template-columns: repeat(auto-fill, minmax(172px, 1fr)); gap: 20px 16px`.

Each tile is a clickable column, `gap: 9px`, `cursor: pointer`:

- **Cover** — `aspect-ratio: 3/4`, `border-radius: 8px`, `background: var(--color-surface)`, `box-shadow: var(--shadow-sm)`, `overflow: hidden`. Placeholder content: initials centred at 30px in `--color-neutral-700`, plus the word "cover" bottom-left (`bottom: 7px; left: 8px`, 9px, `letter-spacing: 0.09em`, uppercase, `--color-neutral-800`). Replace with real art.
- **GFN badge** — absolute `top: 7px; right: 7px`, only when streamable. `lightning` icon 9px + "GFN" at 9px, `letter-spacing: 0.06em`, padding `3px 6px`, `border-radius: 6px`, background `#1d2a14`, colour `#a3d95a`, `box-shadow: inset 0 0 0 1px #3f5c22`. `title="Confirmed on GeForce NOW"`.
- **Score badge** — absolute `bottom: 7px; right: 7px`, only when a score exists. Padding `2px 6px`, `border-radius: 6px`, 10px tabular-nums, background `color-mix(in srgb, var(--color-bg) 78%, transparent)`, colour `--color-neutral-300`, `box-shadow: inset 0 0 0 1px var(--color-neutral-800)`.
- **Title** — 13px, `line-height: 1.3`, `text-wrap: pretty`. Wraps to two lines; do not truncate.
- **Genres** — first three, comma-joined, 11px, 45% muted, single line with `text-overflow: ellipsis`.
- **Store pills** — wrapping flex row, `gap: 5px`. Each pill: height 21px, padding `0 7px`, `border-radius: 6px`, 10px text, background `--color-neutral-900`, colour `--color-neutral-300`, `box-shadow: inset 0 0 0 1px var(--color-neutral-800)`, `gap: 5px` between mark and name. Mark is the store logo (currently a 10px/600 letter in `--color-accent-400`); name is "Steam" / "Epic" / "GOG" / "Xbox". `title` attribute carries the full store name ("Epic Games Store", "GOG.com", "Xbox / PC Game Pass").

**Rows view** — the `.table` class (fading row rules are built into it; keep them). Column widths: Game 46%, Score 64px, Genres auto, Stores 190px. Header cells are 11px uppercase, `letter-spacing: 0.08em`, 60% muted.

Each row is clickable (`cursor: pointer`) and contains:

- Cover thumbnail 34×45px, `border-radius: 5px`, same placeholder treatment at 12px.
- Title 14px, 12px gap from the thumbnail.
- GFN `lightning` icon 13px in `#a3d95a` immediately after the title when streamable (no label in this view).
- Score, tabular-nums, `--color-neutral-400`.
- Genres, 13px, 60% muted (first three).
- Store pills, identical to grid.

Row cells use `padding: 9px 8px` on the game cell; the table's own `--space-2` padding elsewhere. Row hover tint comes from `.table` — do not restyle it.

### 2. Detail panel (opens from any Library grid tile or row)

A right-side sliding panel, not a modal.

- **Scrim** — `position: fixed; inset: 0; z-index: 40`, `background: color-mix(in srgb, var(--color-neutral-900) 55%, transparent)`. Click closes.
- **Panel** — `position: fixed; top/right/bottom: 0; z-index: 41`, `width: min(430px, 100%)`, `overflow: auto`, `padding: 24px`, `background: var(--color-surface)`, `box-shadow: var(--shadow-lg)`. Add a slide-in transition (~180ms, ease-out) when implementing; also close on Escape and trap focus while open.

Contents top to bottom:

1. Close button — `.btn.btn-icon.btn-secondary` (36×36) with Phosphor `x` at 15px, right-aligned. `aria-label="Close"`.
2. Cover — 132px wide, `aspect-ratio: 3/4`, `border-radius: 8px`, on `--color-bg`, monogram at 26px.
3. Title — `h3`, 23px, `margin: 18px 0 0`, `text-wrap: pretty`.
4. Meta line — `year · "{score} score"|"No score" · "{hours} h played"|"Never played"`, separated by `·`, 12px, 50% muted, `gap: 8px`, `margin-top: 10px`.
5. Genre tags — all genres as `.tag.tag-neutral`, wrapping, `gap: 6px`, `margin-top: 16px`.
6. Solid 1px `var(--color-divider)` rule, `margin: 20px 0` (in-panel separator — does not fade).
7. **"Owned on"** — `h6` label, 55% muted. Then one row per store: `padding: 9px 11px`, `border-radius: 8px`, `background: var(--color-bg)`, `gap: 11px`. A 26×26px rounded-6px mark tile (`box-shadow: inset 0 0 0 1px var(--color-neutral-800)`, logo/letter in `--color-accent-400`), the full store name at 13px, and a right-aligned 11px/42%-muted detail — "Purchased", or "Game Pass" for Xbox entries.
8. **"GeForce NOW"** — `h6` label, then one status row on `--color-bg`, `padding: 10px 12px`, `border-radius: 8px`, `gap: 9px`, with the `lightning` icon 15px and a 13px line. Streamable: "Confirmed streamable — 4K / 120 fps tier" in `#a3d95a`. Not streamable: "Not available on GeForce NOW" in 50% muted.
9. **Actions** — `margin-top: 24px`, `gap: 8px`. Primary `.btn.btn-primary`: "Stream now" when streamable, otherwise "Launch locally". Secondary `.btn.btn-secondary`: "Open store page". Wire these to the GFN deep link and the store URL respectively.

### 3. Unmatched

`max-width: 1000px`. Intro: "Store entries with no metadata match. Confirm a suggestion or search manually."

A `.table` with columns: Store entry 34% · Source 90px · Suggested match · Confidence 92px · actions 168px.

- Store entry — the raw string from the store, 14px.
- Source — `.tag.tag-neutral` with the store name.
- Suggested match — 13px, 70% muted; `"— no match"` when there is no candidate.
- Confidence — two-decimal score, tabular-nums, 13px. `≥ 0.75` renders in `--color-accent-300`; below that in `--color-neutral-500`.
- Actions — right-aligned, `gap: 6px`: `.btn.btn-primary` "Confirm" and `.btn.btn-secondary` "Search", both at 12px, `padding: 4px 10px`.

Behaviour: Confirm applies the suggested match and removes the row; Search opens metadata lookup for the raw string. Sort by confidence descending so the easy wins are at the top.

### 4. Discover

`max-width: 1240px`. Intro: "Titles you don't own, drawn from the genres you already keep. Streamable picks are marked."

`display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin-top: 22px`.

Each card is `.card.elev-sm` containing a `gap: 12px` row:

- 52×70px cover tile, `border-radius: 6px`, on `--color-bg`, monogram at 15px.
- `.card-title` at 15px; genres beneath at 11px/45% muted, `margin-top: 4px`; then a `gap: 6px` row (`margin-top: 8px`) with a `.tag.tag-neutral` score (tabular-nums) and, when streamable, a GFN tag (background `#1d2a14`, colour `#a3d95a`, `box-shadow: inset 0 0 0 1px #3f5c22`).

Below, a `.card-meta` row with `justify-content: space-between`: the recommendation reason on the left ("You keep narrative RPGs", "Like Frostpunk", "In Game Pass now") and a `.btn.btn-ghost` "Wishlist" at 12px on the right.

### 5. Xbox

`max-width: 1000px`. Intro: "Owned Xbox titles and current Game Pass rotation, kept separate from purchases."

**Stat band** — four `.card.elev-sm`, `flex: 1 1 180px`, `gap: 12px`, `margin: 22px 0 26px`. Each: a 26px heading-font tabular-nums figure over a `.card-meta` label. Labels: "Owned on Xbox", "In Game Pass now", "Leaving within 30 days", "Also streamable on GFN" — the last figure is tinted `--color-accent-400`.

**"Leaving Game Pass soon"** — `h4` heading, `margin-bottom: 12px`, then a `.table`: Title · Leaves (110px, `--color-neutral-400`) · Owned elsewhere (130px, 60% muted, `—` when not owned). Sort by leave date ascending.

### 6. Connect

`max-width: 780px`. Intro: "Linked stores and the last time each one was read."

A vertical stack, `gap: 10px`, `margin-top: 22px`. Each connection is a `.card.elev-sm` laid out as a row: `align-items: center`, `gap: 16px`, `padding: 14px 16px`.

- 38×38px mark tile, `border-radius: 8px`, on `--color-bg`, `box-shadow: inset 0 0 0 1px var(--color-neutral-800)`, logo/letter at 14px/600 in `--color-accent-400`.
- Name at 15px in the heading font; detail line beneath at 12px/48% muted — `"{n} titles · synced {relative time}"`, or the failure reason ("Token expired 3 days ago").
- Status `.tag` — connected: background `--color-neutral-800`, text `--color-neutral-100`. Needs attention: background `--color-accent-800`, text `--color-accent-100`.
- `.btn.btn-secondary` at 12px — "Resync" when healthy, "Reconnect" when reauth is needed.

## Interactions & behaviour

- **Navigation** — five top-level routes. In the prototype these are client state; in production use real URLs (`/`, `/unmatched`, `/discover`, `/xbox`, `/connect`) so links and back/forward work.
- **Filtering** — all Library filters compose with AND and should be reflected in the query string so a filtered view is shareable and survives reload. Debounce search input ~150ms.
- **View mode** — grid/rows persists across sessions (localStorage or user prefs).
- **Detail panel** — opens on tile/row click; closes on scrim click, the close button, and Escape. Give it a URL too (`/game/{id}` or `?game={id}`) so it is linkable and the back button closes it.
- **Hover / active / focus** — take these from Nocturne, do not invent: outlined buttons tint with `color-mix(in srgb, var(--color-accent) 12%, transparent)` on hover and 22% on active; secondary buttons use text tints at 7%/14%; table rows have a built-in 4% hover tint; focus is always `2px solid var(--color-accent)` with `outline-offset: 2px` (inputs use `outline-offset: 0` and switch their border to accent instead). Never leave a default browser focus ring.
- **Performance** — 614 titles in a grid of full-bleed cover images needs `loading="lazy"` on covers and, ideally, windowing/virtualisation in the rows view. The prototype renders a 30-title sample.
- **Responsive** — everything is fluid. The grid reflows via `auto-fill minmax(172px, 1fr)`; the filter bar wraps; the detail panel becomes full width under 430px. The rows table needs a horizontal-scroll wrapper or a stacked treatment on narrow screens — decide when implementing, the prototype does not cover it.

## State

Library: `query`, `store`, `genre`, `sort`, `minScore`, `gfnOnly`, `viewMode`, `selectedGameId`. Route: `page`.

Game record shape used by the prototype:

```
{ id, title, score, genres: string[], stores: ('steam'|'epic'|'gog'|'xbox')[],
  gfn: boolean, year, hours }
```

Store metadata is a lookup keyed on the store slug, carrying `mark` (logo), short `name` for pills, and full `label` for tooltips and the detail panel.

Fetching: the Library needs the full owned list (paginate or stream if 614 records is heavy), Unmatched needs pending match candidates with confidence scores, Discover needs recommendations with a reason string, Xbox needs Game Pass rotation with leave dates, Connect needs per-store sync status and last-sync timestamps.

## Data in the prototype

**All content in the HTML is invented sample data** — 30 stand-in titles, fabricated scores, hours, Game Pass leave dates and sync timestamps. A few titles were carried over from the screenshot of the current site; the rest are placeholders. Do not treat any figure in the prototype (614, 48, 126, 9, 31, confidence scores) as real. Wire everything to the live library.

## Assets

- **Cover art** — none supplied. Source from your existing metadata provider (the current site already shows cover thumbnails).
- **Store logos** — none supplied; monogram letters stand in. Use each store's official brand mark.
- **Icons** — Phosphor (regular), inlined as SVG. Install `@phosphor-icons/*` for your framework rather than copying paths out of the prototype.
- **Fonts** — Inter, loaded by `nocturne-styles.css` from Google Fonts. Self-host if your app already does.

## Files in this bundle

| File | What it is |
| --- | --- |
| `Games Library.dc.html` | The design prototype — all five pages plus the detail panel. Reference only; reads as inline-styled HTML with a state class at the bottom. |
| `nocturne-styles.css` | The Nocturne stylesheet — tokens (`:root`) plus the component layer (`.btn`, `.tag`, `.card`, `.table`, `.input`, `.seg`, `.dialog`). Source of truth for every value. |
| `nocturne-readme.md` | The Nocturne written guide — direction, colour, type, do/don't. |
| `before-current-site.png` | Screenshot of the current production Library page, for before/after comparison. |
| `screens/library-grid.png` | Library, grid view (default). |
| `screens/library-rows.png` | Library, rows view. |
| `screens/detail-panel.png` | Game detail panel, shown detached from the page and scaled down so the full contents are visible. |
| `screens/unmatched.png` | Unmatched page. |
| `screens/discover.png` | Discover page. |
| `screens/xbox.png` | Xbox page. |
| `screens/connect.png` | Connect page. |

Screenshots are captured at the prototype's preview width (~910px) and are cropped to the fold — they show treatment, not full page length. The HTML is authoritative for anything below the fold.
