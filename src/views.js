import { AUTH_URL as GOG_AUTH_URL } from "./gog.js";
import { AUTH_URL as EPIC_AUTH_URL } from "./epic.js";

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Phosphor (regular), inlined on currentColor — the design calls for five.
const ICONS = {
  search: `<path d="M112 44a68 68 0 1 0 68 68 68.08 68.08 0 0 0-68-68Zm0 124a56 56 0 1 1 56-56 56.06 56.06 0 0 1-56 56Zm108.24 43.76-45.11-45.11a76.06 76.06 0 1 0-8.48 8.48l45.11 45.11a6 6 0 0 0 8.48-8.48Z"/>`,
  lightning: `<path d="M215.79 118.17a8 8 0 0 0-5-5.66L153.18 90.9l14.66-73.33a8 8 0 0 0-13.69-7l-112 120a8 8 0 0 0 3 13l57.63 21.61-14.62 73.25a8 8 0 0 0 13.69 7l112-120a8 8 0 0 0 1.94-7.26Z"/>`,
  grid: `<path d="M104 40H56a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Zm96 0h-48a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Zm-96 96H56a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16v-48a16 16 0 0 0-16-16Zm96 0h-48a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16v-48a16 16 0 0 0-16-16Z"/>`,
  rows: `<path d="M216 64H40a8 8 0 0 1 0-16h176a8 8 0 0 1 0 16Zm0 56H40a8 8 0 0 1 0-16h176a8 8 0 0 1 0 16Zm0 56H40a8 8 0 0 1 0-16h176a8 8 0 0 1 0 16Zm0 56H40a8 8 0 0 1 0-16h176a8 8 0 0 1 0 16Z"/>`,
  x: `<path d="m205.66 194.34-8 8a8 8 0 0 1-11.32 0L128 144.4l-58.34 57.94a8 8 0 0 1-11.32-11.32L116.28 133 58.34 74.66a8 8 0 0 1 11.32-11.32L128 121.6l58.34-57.94a8 8 0 0 1 11.32 11.32L139.72 133l57.94 58.34a8 8 0 0 1 0 3Z"/>`,
};

export const icon = (name, size = 15, style = "") =>
  `<svg viewBox="0 0 256 256" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" style="${style}">${ICONS[name]}</svg>`;

export const STORE_NAMES = { steam: "Steam", gog: "GOG", epic: "Epic", xbox: "Xbox" };
const STORE_LABELS = {
  steam: "Steam",
  gog: "GOG.com",
  epic: "Epic Games Store",
  xbox: "Xbox (Play Anywhere)",
};

// Simplified marks in each store's colour. The handoff asks for the official
// brand SVGs; these are stand-ins drawn here rather than shipped assets.
const STORE_ICONS = {
  steam: `<circle cx="12" cy="12" r="11" fill="#1b2838"/><circle cx="15.5" cy="8.5" r="3.6" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="8.2" cy="15.4" r="3.1" fill="#fff"/><path d="M5 15.4 15 8.5" stroke="#fff" stroke-width="1.4"/>`,
  gog: `<circle cx="12" cy="12" r="11" fill="#8b5cf6"/><path d="M15.4 8.6H9.8a1.6 1.6 0 0 0-1.6 1.6v3.6a1.6 1.6 0 0 0 1.6 1.6h5.6v-3.2h-3" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="square"/>`,
  epic: `<rect x="1" y="1" width="22" height="22" rx="5" fill="#2a2a2a"/><path d="M9 6.8h6.2M9 12h5M9 17.2h6.2M9 6.8v10.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
  xbox: `<circle cx="12" cy="12" r="11" fill="#107c10"/><path d="M7.4 6.6C9.8 9 14.2 15 16.6 17.4M16.6 6.6C14.2 9 9.8 15 7.4 17.4" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/>`,
};

export const storeMark = (store, size = 13) =>
  STORE_ICONS[store]
    ? `<svg viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${esc(STORE_LABELS[store] ?? store)}" style="border-radius:50%;display:block">${STORE_ICONS[store]}</svg>`
    : `<span style="font-size:10px;font-weight:600;color:var(--color-accent-400)">${esc((store ?? "?")[0].toUpperCase())}</span>`;

// Logo + name, the setting the owner chose.
const storePill = ({ store, status }) => `<span class="store-pill" title="${esc(
  `${STORE_LABELS[store] ?? store}${status === "AVAILABLE" ? " — confirmed on GeForce NOW" : ""}`,
)}">${storeMark(store, 12)}${esc(STORE_NAMES[store] ?? store)}</span>`;

const NAV = [
  ["/", "Library"],
  ["/unmatched", "Unmatched"],
  ["/discover", "Discover"],
  ["/xbox", "Xbox"],
  ["/connect", "Connect"],
];

const WIDTHS = { "/": 1240, "/discover": 1240, "/unmatched": 1000, "/xbox": 1000, "/connect": 780 };

export const layout = (title, body, { path = "/", pending = 0, panel = "" } = {}) => `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Games Library</title>
<link rel="stylesheet" href="/nocturne.css">
<style>
  body { padding-bottom: 64px; }
  .header {
    position: sticky; top: 0; z-index: 20; display: flex; align-items: center;
    padding: 14px 28px; gap: 4px;
    background: color-mix(in srgb, var(--color-bg) 88%, transparent);
    backdrop-filter: blur(10px);
    background-image: linear-gradient(to right, transparent, var(--color-divider) 48px, var(--color-divider) calc(100% - 48px), transparent);
    background-repeat: no-repeat; background-position: bottom; background-size: 100% 1px;
  }
  .brand { display: flex; align-items: center; gap: 9px; margin-right: auto; text-decoration: none; color: inherit; }
  .brand-mark {
    width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--color-accent);
    display: grid; place-items: center; font-size: 11px; font-weight: 600; color: var(--color-accent);
  }
  .brand-name { font-size: 16px; font-weight: 500; letter-spacing: -0.01em; }
  .nav-link {
    font-size: 13px; padding: 6px 11px; border-radius: 8px; text-decoration: none;
    color: color-mix(in srgb, var(--color-text) 72%, transparent);
  }
  .nav-link:hover { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
  .nav-link.active { color: var(--color-accent); background: var(--color-accent-900); }
  .container { padding: 0 28px; max-width: ${WIDTHS[path] ?? 1240}px; margin: 0 auto; }
  .page-title { padding: 34px 0 20px; }
  .page-title h1 { font-size: 34px; letter-spacing: -0.02em; margin: 0; }
  .title-row { display: flex; align-items: flex-end; gap: 12px; }
  .title-count { font-size: 13px; color: color-mix(in srgb, var(--color-text) 50%, transparent); padding-bottom: 6px; }
  .intro { font-size: 14px; color: color-mix(in srgb, var(--color-text) 55%, transparent); max-width: 54ch; margin: 10px 0 0; }
  .rule-fade {
    height: 1px; border: 0; margin: 0;
    background: linear-gradient(to right, transparent, var(--color-divider) 48px, var(--color-divider) calc(100% - 48px), transparent);
  }
  .muted { color: color-mix(in srgb, var(--color-text) 45%, transparent); }
  .empty { text-align: center; padding: 70px 0; font-size: 14px; color: color-mix(in srgb, var(--color-text) 45%, transparent); }

  .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-bottom: 14px; }
  .search-wrap { position: relative; flex: 1 1 240px; min-width: 200px; max-width: 320px; }
  .search-wrap svg { position: absolute; left: 10px; top: 11px; opacity: 0.45; pointer-events: none; }
  .search-wrap .input { padding-left: 31px; width: 100%; }
  /* Nocturne's .input is width:100%, which makes every control claim a whole
     row. In the filter bar they size to their own min-width instead. */
  .filters .input { width: auto; }
  .filters .search-wrap .input { width: 100%; }
  select.input { appearance: none; padding-right: 26px; }
  .gfn-toggle {
    display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 7px 12px;
    border-radius: var(--radius-md); border: 1px solid var(--color-divider); text-decoration: none;
    color: color-mix(in srgb, var(--color-text) 75%, transparent); background: transparent;
  }
  .gfn-toggle.on { border-color: #5d8a2c; color: #a3d95a; background: #1d2a14; }
  .score-range { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: color-mix(in srgb, var(--color-text) 62%, transparent); }
  .score-range input[type=range] { width: 92px; accent-color: var(--color-accent); }
  .seg { margin-left: auto; }
  .seg-link {
    display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 7px 12px;
    text-decoration: none; color: inherit;
  }
  .seg-link + .seg-link { border-left: 1px solid var(--color-divider); }
  .seg-link.on { color: var(--color-accent); box-shadow: inset 0 0 0 1px var(--color-accent); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(172px, 1fr)); gap: 20px 16px; }
  .tile { display: flex; flex-direction: column; gap: 9px; cursor: pointer; text-decoration: none; color: inherit; }
  .cover {
    position: relative; aspect-ratio: 3/4; border-radius: 8px; background: var(--color-surface);
    box-shadow: var(--shadow-sm); overflow: hidden; display: grid; place-items: center;
  }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .cover-mono { font-size: 30px; font-weight: 600; color: var(--color-neutral-700); }
  .cover-word { position: absolute; bottom: 7px; left: 8px; font-size: 9px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--color-neutral-800); }
  .gfn-badge {
    position: absolute; top: 7px; right: 7px; display: inline-flex; align-items: center; gap: 3px;
    font-size: 9px; letter-spacing: 0.06em; padding: 3px 6px; border-radius: 6px;
    background: #1d2a14; color: #a3d95a; box-shadow: inset 0 0 0 1px #3f5c22;
  }
  .score-badge {
    position: absolute; bottom: 7px; right: 7px; padding: 2px 6px; border-radius: 6px;
    font-size: 10px; font-variant-numeric: tabular-nums;
    background: color-mix(in srgb, var(--color-bg) 78%, transparent);
    color: var(--color-neutral-300); box-shadow: inset 0 0 0 1px var(--color-neutral-800);
  }
  .tile-title { font-size: 13px; line-height: 1.3; text-wrap: pretty; }
  .tile-genres { font-size: 11px; color: color-mix(in srgb, var(--color-text) 45%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pills { display: flex; flex-wrap: wrap; gap: 5px; }
  .store-pill {
    display: inline-flex; align-items: center; gap: 5px; height: 21px; padding: 0 7px;
    border-radius: 6px; font-size: 10px; background: var(--color-neutral-900);
    color: var(--color-neutral-300); box-shadow: inset 0 0 0 1px var(--color-neutral-800);
  }
  .table tbody tr { cursor: pointer; }
  .table a.row-link { color: inherit; text-decoration: none; display: flex; align-items: center; gap: 12px; }
  .thumb { width: 34px; height: 45px; border-radius: 5px; background: var(--color-surface); box-shadow: var(--shadow-sm); display: grid; place-items: center; flex: none; overflow: hidden; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .thumb span { font-size: 12px; font-weight: 600; color: var(--color-neutral-700); }
  .num { font-variant-numeric: tabular-nums; color: var(--color-neutral-400); }

  .scrim { position: fixed; inset: 0; z-index: 40; background: color-mix(in srgb, var(--color-neutral-900) 55%, transparent); }
  .panel {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 41; width: min(430px, 100%);
    overflow: auto; padding: 24px; background: var(--color-surface); box-shadow: var(--shadow-lg);
    animation: slide-in 180ms ease-out;
  }
  @keyframes slide-in { from { transform: translateX(16px); opacity: 0.6 } to { transform: none; opacity: 1 } }
  .panel-close { display: flex; justify-content: flex-end; }
  .panel h3 { font-size: 23px; margin: 18px 0 0; text-wrap: pretty; }
  .panel-meta { display: flex; gap: 8px; font-size: 12px; margin-top: 10px; color: color-mix(in srgb, var(--color-text) 50%, transparent); }
  .panel-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
  .panel hr { border: 0; border-top: 1px solid var(--color-divider); margin: 20px 0; }
  .panel h6 { color: color-mix(in srgb, var(--color-text) 55%, transparent); margin: 0 0 var(--space-3); }
  .own-row { display: flex; align-items: center; gap: 11px; padding: 9px 11px; border-radius: 8px; background: var(--color-bg); margin-bottom: 6px; }
  .own-mark { width: 26px; height: 26px; border-radius: 6px; display: grid; place-items: center; box-shadow: inset 0 0 0 1px var(--color-neutral-800); flex: none; }
  .own-detail { margin-left: auto; font-size: 11px; color: color-mix(in srgb, var(--color-text) 42%, transparent); }
  .gfn-row { display: flex; align-items: center; gap: 9px; padding: 10px 12px; border-radius: 8px; background: var(--color-bg); font-size: 13px; }
  .panel-actions { display: flex; gap: 8px; margin-top: 24px; }
  .stat-band { display: flex; flex-wrap: wrap; gap: 12px; margin: 22px 0 26px; }
  .stat-band .card { flex: 1 1 180px; }
  .stat-figure { font-family: var(--font-heading); font-size: 26px; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .connect-row { display: flex; align-items: center; gap: 16px; padding: 14px 16px; }
  .connect-mark { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; background: var(--color-bg); box-shadow: inset 0 0 0 1px var(--color-neutral-800); flex: none; }
  .stack { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
  .field { display: block; margin: 8px 0; font-size: 13px; }
  .field .input { width: 100%; max-width: 100%; margin-top: 4px; }
  textarea.input { width: 100%; min-height: 9rem; font: inherit; }
  .stale { border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; font-size: 13px; background: var(--color-accent-900); color: var(--color-accent-200); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  form.inline { display: inline; }
  @media (max-width: 640px) { .table-wrap { overflow-x: auto; } }
</style>
<header class="header">
  <a class="brand" href="/"><span class="brand-mark">GL</span><span class="brand-name">Games Library</span></a>
  ${NAV.map(
    ([href, label]) =>
      `<a class="nav-link${path === href ? " active" : ""}" href="${href}">${label}${
        href === "/unmatched" && pending ? ` (${pending})` : ""
      }</a>`,
  ).join("")}
</header>
<div class="container">${body}</div>
${panel}
<script>
  // The panel is a real URL, so Escape and the scrim just navigate back to it.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelector("[data-close]")?.click();
  });
  const panel = document.querySelector(".panel");
  if (panel) (panel.querySelector("[data-close]") ?? panel).focus?.();
</script>
`;

const title = (heading, { count = "", intro = "" } = {}) => `
<div class="page-title">
  <div class="title-row"><h1>${esc(heading)}</h1>${count ? `<span class="title-count">${esc(count)}</span>` : ""}</div>
  ${intro ? `<p class="intro">${esc(intro)}</p>` : ""}
</div>`;

const initials = (t) =>
  t
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

// Real art where we have it; the monogram tile is the fallback the design asks
// for in place of an empty grey box.
const coverArt = (g, cls = "cover", mono = 30) =>
  `<div class="${cls}">${
    g.cover_url
      ? `<img src="${esc(g.cover_url)}" alt="" loading="lazy">`
      : `<span class="cover-mono" style="font-size:${mono}px">${esc(initials(g.title))}</span>${
          cls === "cover" ? `<span class="cover-word">cover</span>` : ""
        }`
  }`;

const scoreTitle = (g) =>
  g.rating_source === "metacritic"
    ? `Metacritic ${g.rating}`
    : `IGDB critic aggregate ${g.rating}, from ${g.rating_source?.split(":")[1] ?? "?"} reviews`;

const hours = (mins) => (mins ? `${Math.round(mins / 60)} h played` : "Never played");

const qs = (f, extra = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) {
    if (v !== "" && v !== false && v !== 0 && v != null) p.set(k, v === true ? "1" : v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const listPage = (games, filters = {}, opts = {}) => {
  const { hidden = 0, stale = [], genres = [], total = 0, view = "grid", matching = 0 } = opts;
  return `
${staleBanner(stale)}
${title("Library", {
  count:
    games.length < matching
      ? `showing ${games.length} of ${matching} matching · ${total} titles owned`
      : `${games.length} of ${total} titles`,
})}
<form class="filters" method="get" action="/">
  <span class="search-wrap">
    ${icon("search", 15)}
    <input class="input" type="search" name="q" placeholder="Search titles" value="${esc(filters.q ?? "")}">
  </span>
  <select class="input" name="store" style="min-width:132px">
    <option value="">All stores</option>
    ${Object.entries(STORE_NAMES)
      .map(([v, l]) => `<option value="${v}"${filters.store === v ? " selected" : ""}>${l}</option>`)
      .join("")}
  </select>
  <select class="input" name="genre" style="min-width:140px">
    <option value="">All genres</option>
    ${genres.map((g) => `<option value="${esc(g)}"${filters.genre === g ? " selected" : ""}>${esc(g)}</option>`).join("")}
  </select>
  <select class="input" name="sort" style="min-width:124px">
    <option value="">A–Z</option>
    <option value="rating"${filters.sort === "rating" ? " selected" : ""}>Highest score</option>
    <option value="year"${filters.sort === "year" ? " selected" : ""}>Newest</option>
  </select>
  <a class="gfn-toggle${filters.gfn ? " on" : ""}" href="/${qs(filters, { gfn: !filters.gfn, view: "" })}">
    ${icon("lightning", 14)} GeForce NOW only
  </a>
  <span class="score-range">
    Score ≥ ${filters.minScore ? filters.minScore : "any"}
    <input type="range" name="minScore" min="0" max="95" step="5" value="${Number(filters.minScore) || 0}">
  </span>
  ${filters.all || hidden ? `<label style="font-size:12px" class="muted"><input type="checkbox" name="all" value="1"${filters.all ? " checked" : ""}> ${hidden} hidden</label>` : ""}
  <button class="btn btn-secondary">Apply</button>
  <span class="seg">
    <a class="seg-link${view === "grid" ? " on" : ""}" href="/${qs(filters, { view: "grid" })}">${icon("grid", 14)} Grid</a>
    <a class="seg-link${view === "rows" ? " on" : ""}" href="/${qs(filters, { view: "rows" })}">${icon("rows", 14)} Rows</a>
  </span>
</form>
<hr class="rule-fade" style="margin-bottom:22px">
${
  games.length === 0
    ? `<p class="empty">No titles match those filters.</p>`
    : view === "rows"
      ? rowsView(games, filters, view)
      : gridView(games, filters, view)
}
${
  games.length < matching
    ? `<p class="empty" style="padding:34px 0"><a href="/${qs(filters, { view, limit: "all" })}">Show all ${matching}</a></p>`
    : ""
}`;
};

const gridView = (games, filters, view) => `<div class="grid">
${games
  .map(
    (g) => `<a class="tile" href="/${qs(filters, { view, game: g.id })}">
  ${coverArt(g)}
    ${g.streamable ? `<span class="gfn-badge" title="Confirmed on GeForce NOW">${icon("lightning", 9)}GFN</span>` : ""}
    ${g.rating != null ? `<span class="score-badge" title="${esc(scoreTitle(g))}">${g.rating}</span>` : ""}
  </div>
  <span class="tile-title">${esc(g.title)}</span>
  <span class="tile-genres">${esc((g.genres ?? "").split(", ").slice(0, 3).join(", "))}</span>
  <span class="pills">${g.stores.map(storePill).join("")}</span>
</a>`,
  )
  .join("\n")}
</div>`;

const rowsView = (games, filters, view) => `<div class="table-wrap"><table class="table">
  <thead><tr><th style="width:46%">Game</th><th style="width:64px">Score</th><th>Genres</th><th style="width:190px">Stores</th></tr></thead>
  <tbody>
${games
  .map(
    (g) => `  <tr>
    <td style="padding:9px 8px"><a class="row-link" href="/${qs(filters, { view, game: g.id })}">
      <span class="thumb">${g.cover_url ? `<img src="${esc(g.cover_url)}" alt="" loading="lazy">` : `<span>${esc(initials(g.title))}</span>`}</span>
      <span style="font-size:14px">${esc(g.title)}</span>
      ${g.streamable ? `<span style="color:#a3d95a" title="Confirmed on GeForce NOW">${icon("lightning", 13)}</span>` : ""}
    </a></td>
    <td class="num">${g.rating != null ? `<span title="${esc(scoreTitle(g))}">${g.rating}</span>` : ""}</td>
    <td style="font-size:13px;color:color-mix(in srgb, var(--color-text) 60%, transparent)">${esc((g.genres ?? "").split(", ").slice(0, 3).join(", "))}</td>
    <td><span class="pills">${g.stores.map(storePill).join("")}</span></td>
  </tr>`,
  )
  .join("\n")}
  </tbody>
</table></div>`;

// A right-side panel with its own URL, so the back button closes it and a
// filtered view stays linkable.
export const detailPanel = (game, closeHref) => {
  if (!game) return "";
  const streamable = game.entitlements.filter((e) => e.gfn_status === "AVAILABLE");
  const meta = [game.year, game.rating != null ? `${game.rating} score` : "No score", hours(game.playtime_minutes)];
  return `
<a class="scrim" href="${esc(closeHref)}" aria-label="Close"></a>
<aside class="panel" role="dialog" aria-modal="true" aria-label="${esc(game.title)}">
  <div class="panel-close"><a class="btn btn-secondary btn-icon" data-close href="${esc(closeHref)}" aria-label="Close">${icon("x", 15)}</a></div>
  <div class="cover" style="width:132px">${
    game.cover_url
      ? `<img src="${esc(game.cover_url)}" alt="">`
      : `<span class="cover-mono" style="font-size:26px">${esc(initials(game.title))}</span>`
  }</div>
  <h3>${esc(game.title)}</h3>
  <div class="panel-meta">${meta.filter(Boolean).map(esc).join(" · ")}</div>
  <div class="panel-tags">${(game.genres ?? "")
    .split(", ")
    .filter(Boolean)
    .map((t) => `<span class="tag tag-neutral">${esc(t)}</span>`)
    .join("")}</div>
  <hr>
  <h6>Owned on</h6>
  ${game.entitlements
    .map(
      (e) => `<div class="own-row">
    <span class="own-mark">${storeMark(e.store, 16)}</span>
    <span style="font-size:13px">${esc(STORE_LABELS[e.store] ?? e.store)}</span>
    <span class="own-detail">${e.playtime_minutes ? esc(hours(e.playtime_minutes)) : "Purchased"}</span>
  </div>`,
    )
    .join("")}
  <h6 style="margin-top:20px">GeForce NOW</h6>
  <div class="gfn-row">
    <span style="color:${streamable.length ? "#a3d95a" : "inherit"}">${icon("lightning", 15)}</span>
    ${
      streamable.length
        ? `<span style="color:#a3d95a">Confirmed streamable via ${streamable.map((e) => esc(STORE_NAMES[e.store] ?? e.store)).join(", ")}</span>`
        : `<span class="muted">Not found in the GeForce NOW catalogue</span>`
    }
  </div>
  <div class="panel-actions">
    ${
      streamable.length
        ? `<a class="btn btn-primary" href="https://play.geforcenow.com/" target="_blank" rel="noopener">Stream now</a>`
        : ""
    }
    <a class="btn btn-secondary" href="${esc(storeUrl(game.entitlements[0]))}" target="_blank" rel="noopener">Open store page</a>
    <a class="btn btn-ghost" href="/merge?from=${game.id}">Merge</a>
  </div>
</aside>`;
};

// Only Steam gives us an id that resolves to a product page; the others get a
// store search for the title, which is better than a dead link.
const storeUrl = (e) => {
  if (!e) return "#";
  const q = encodeURIComponent(e.store_title);
  return {
    steam: `https://store.steampowered.com/app/${e.store_game_id}`,
    gog: `https://www.gog.com/en/games?query=${q}`,
    epic: `https://store.epicgames.com/en-US/browse?q=${q}`,
    xbox: `https://www.xbox.com/en-AU/Search/Results?q=${q}`,
  }[e.store] ?? "#";
};

export const staleBanner = (stale) => {
  if (!stale?.length) return "";
  const names = { ...STORE_NAMES, gfn: "GeForce NOW" };
  return `<div class="stale">
  ${stale
    .map((s) =>
      s.status === "needs_reauth"
        ? `<strong>${esc(names[s.store] ?? s.store)}</strong> needs reconnecting`
        : `<strong>${esc(names[s.store] ?? s.store)}</strong> ${Number.isFinite(s.days) ? `last synced ${s.days} days ago` : "has never been synced"}`,
    )
    .join(" · ")}
  ${stale
    .map((s) =>
      s.status === "needs_reauth"
        ? `<a class="btn btn-secondary" href="/connect" style="font-size:12px">Reconnect</a>`
        : `<form class="inline" method="post" action="/sync/${s.store}"><button class="btn btn-secondary" style="font-size:12px">Sync ${esc(names[s.store] ?? s.store)}</button></form>`,
    )
    .join(" ")}
</div>`;
};

export const unmatchedPage = (items, titles) => {
  if (items.length === 0)
    return `${title("Unmatched", { intro: "Store entries with no metadata match. Confirm a suggestion or correct it by hand." })}
<p class="empty">Nothing to review — every entitlement is identified or confirmed.</p>`;

  return `${title("Unmatched", {
    count: `${items.length} to review`,
    intro: "Store entries whose match was guessed from the title alone, and which merged with something else. Confirm or correct each one.",
  })}
<div class="table-wrap"><table class="table">
  <thead><tr><th style="width:34%">Store entry</th><th style="width:90px">Source</th><th>Suggested match</th><th style="width:300px">Confirm as</th></tr></thead>
  <tbody>
${items
  .map(
    (i) => `  <tr>
    <td>${esc(i.store_title)}</td>
    <td><span class="tag tag-neutral">${esc(STORE_NAMES[i.store] ?? i.store)}</span></td>
    <td style="font-size:13px;color:color-mix(in srgb, var(--color-text) 70%, transparent)">${esc(i.guess ?? "— no match")}</td>
    <td>
      <form method="post" action="/unmatched" style="display:flex;gap:6px">
        <input type="hidden" name="id" value="${i.id}">
        <input class="input" name="title" list="games" value="${esc(i.guess ?? i.store_title)}" required style="flex:1;font-size:12px;padding:4px 8px">
        <button class="btn btn-primary" style="font-size:12px;padding:4px 10px">Confirm</button>
      </form>
    </td>
  </tr>`,
  )
  .join("\n")}
  </tbody>
</table></div>
<datalist id="games">${titles.map((t) => `<option value="${esc(t)}">`).join("")}</datalist>`;
};

const CATALOGUE_STORES = {
  STEAM: "steam",
  EPIC: "epic",
  GOG: "gog",
  XBOX: "xbox",
  UPLAY: "Ubisoft",
  BATTLENET: "Battle.net",
  EA_APP: "EA app",
  NV_BUNDLE: "NVIDIA bundle",
};

export const discoverPage = (games, filters = {}, total = 0) => `
${title("Discover", {
  count: `${total} titles`,
  intro: "Games on GeForce NOW in Australia that you don't own, and the stores selling them. Everything here streams — you would only be buying the licence.",
})}
<form class="filters" method="get" action="/discover">
  <span class="search-wrap">
    ${icon("search", 15)}
    <input class="input" type="search" name="q" placeholder="Search the catalogue" value="${esc(filters.q ?? "")}">
  </span>
  <select class="input" name="store" style="min-width:150px">
    <option value="">Any store</option>
    ${Object.entries(CATALOGUE_STORES)
      .map(
        ([v, k]) =>
          `<option value="${v}"${filters.store === v ? " selected" : ""}>${esc(STORE_NAMES[k] ?? k)}</option>`,
      )
      .join("")}
  </select>
  <button class="btn btn-secondary">Apply</button>
</form>
<hr class="rule-fade" style="margin-bottom:22px">
${
  games.length === 0
    ? `<p class="empty">No titles match those filters.</p>`
    : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
${games
  .map(
    (g) => `<div class="card elev-sm">
  <div style="display:flex;gap:12px">
    <span class="thumb" style="width:52px;height:70px;border-radius:6px;background:var(--color-bg)">${
      g.cover_url ? `<img src="${esc(g.cover_url)}" alt="" loading="lazy">` : `<span style="font-size:15px">${esc(initials(g.title))}</span>`
    }</span>
    <div style="min-width:0">
      <div class="card-title" style="font-size:15px">${esc(g.title)}</div>
      <div style="font-size:11px;margin-top:4px;color:color-mix(in srgb, var(--color-text) 45%, transparent)">${esc((g.genres ?? "").split(", ").slice(0, 3).join(", "))}</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <span class="tag" style="background:#1d2a14;color:#a3d95a;box-shadow:inset 0 0 0 1px #3f5c22">${icon("lightning", 9)} GFN</span>
        ${g.stores.map((s) => `<span class="store-pill">${storeMark(CATALOGUE_STORES[s] ?? "?", 12)}${esc(STORE_NAMES[CATALOGUE_STORES[s]] ?? CATALOGUE_STORES[s] ?? s)}</span>`).join("")}
      </div>
    </div>
  </div>
</div>`,
  )
  .join("\n")}
</div>`
}`;

export const xboxPage = (items, stats = {}) => `
${title("Xbox", {
  intro: "Xbox Play Anywhere titles, typed in by hand — Xbox publishes no library API, so nothing re-checks them.",
})}
<div class="stat-band">
  ${[
    ["Owned on Xbox", stats.owned ?? 0, false],
    ["Also on another store", stats.shared ?? 0, false],
    ["Streamable on GFN", stats.streamable ?? 0, true],
  ]
    .map(
      ([label, value, tint]) => `<div class="card elev-sm">
    <div class="stat-figure"${tint ? ` style="color:var(--color-accent-400)"` : ""}>${value}</div>
    <div class="card-meta">${label}</div>
  </div>`,
    )
    .join("")}
</div>
<h4>Add titles</h4>
<p class="intro" style="margin-bottom:12px"><strong>Play Anywhere titles only</strong> — those with a PC build tied to the purchase. Console-only and cloud-only games can be neither installed here nor streamed through a PC store. Pasting the same list again is safe.</p>
<form method="post" action="/xbox/add">
  <textarea class="input" name="pasted" placeholder="Halo Infinite&#10;Forza Horizon 5&#10;Starfield" required></textarea>
  <div style="margin-top:10px"><button class="btn btn-primary">Add titles</button></div>
</form>
${
  items.length === 0
    ? `<p class="empty">No Xbox games yet.</p>`
    : `<h4 style="margin-top:26px">Your Xbox titles</h4>
<div class="table-wrap"><table class="table">
  <thead><tr><th>Pasted title</th><th style="width:30%">Matched to</th><th style="width:90px">GFN</th><th style="width:100px"></th></tr></thead>
  <tbody>
${items
  .map(
    (i) => `  <tr>
    <td>${esc(i.store_title)}</td>
    <td style="color:var(--color-neutral-400);font-size:13px">${i.game && i.game !== i.store_title ? esc(i.game) : ""}</td>
    <td>${i.gfn_status === "AVAILABLE" ? `<span style="color:#a3d95a">${icon("lightning", 13)}</span>` : ""}</td>
    <td><form class="inline" method="post" action="/xbox/remove"><input type="hidden" name="id" value="${i.id}"><button class="btn btn-secondary" style="font-size:12px;padding:4px 10px">Remove</button></form></td>
  </tr>`,
  )
  .join("\n")}
  </tbody>
</table></div>`
}`;

export const mergePage = (from, titles) => `
${title("Merge", { intro: "Move this game's stores onto another game. The decision is locked, so a later sync will not split them again." })}
<div class="card elev-sm" style="max-width:520px">
  <div class="card-title" style="font-size:18px">${esc(from.title)}</div>
  <form method="post" action="/merge" style="margin-top:14px">
    <input type="hidden" name="from" value="${from.id}">
    <label class="field">Merge into
      <input class="input" name="into" list="games" autofocus required placeholder="Start typing a game title">
    </label>
    <div class="panel-actions" style="margin-top:14px">
      <button class="btn btn-primary">Merge</button>
      <a class="btn btn-secondary" href="/">Cancel</a>
    </div>
  </form>
</div>
<datalist id="games">${titles.map((t) => `<option value="${esc(t)}">`).join("")}</datalist>`;

const STATUS_TAG = {
  connected: `<span class="tag tag-neutral">Connected</span>`,
  needs_reauth: `<span class="tag tag-accent">Needs attention</span>`,
  error: `<span class="tag tag-accent">Error</span>`,
};

const ago = (iso) => {
  if (!iso) return "never synced";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days === 0) return "synced today";
  return `synced ${days} day${days === 1 ? "" : "s"} ago`;
};

const connectCard = ({ store, label, row, counts = "", body, action }) => `
<div class="card elev-sm">
  <div class="connect-row">
    <span class="connect-mark">${storeMark(store, 20)}</span>
    <div style="min-width:0">
      <div style="font-family:var(--font-heading);font-size:15px">${esc(label)}</div>
      <div style="font-size:12px;color:color-mix(in srgb, var(--color-text) 48%, transparent)">${
        row?.last_error ? esc(row.last_error) : `${counts ? `${counts} · ` : ""}${ago(row?.last_synced_at)}`
      }</div>
    </div>
    <span style="margin-left:auto;display:flex;align-items:center;gap:10px">
      ${STATUS_TAG[row?.status] ?? `<span class="tag tag-neutral">Not connected</span>`}
      ${action ?? ""}
    </span>
  </div>
  ${body ? `<div style="padding:0 16px 14px">${body}</div>` : ""}
</div>`;

export const connectPage = (rows, pendingScores = 0, ratings = {}, counts = {}) => {
  const by = (s) => rows.find((r) => r.store === s);
  const data = (s) => {
    const r = by(s);
    return r?.data ? JSON.parse(r.data) : {};
  };
  const syncBtn = (s, label = "Resync") =>
    `<form class="inline" method="post" action="/sync/${s}"><button class="btn btn-secondary" style="font-size:12px">${label}</button></form>`;

  return `
${title("Connect", { intro: "Linked stores and the last time each one was read." })}
<div class="stack">
${connectCard({
  store: "steam",
  label: "Steam",
  row: by("steam"),
  counts: counts.steam ? `${counts.steam} titles` : "",
  action: by("steam")?.data ? syncBtn("steam") : "",
  body: `<form method="post" action="/connect/steam">
    <p class="intro" style="margin:0 0 8px">Key from <a href="https://steamcommunity.com/dev/apikey">steamcommunity.com/dev/apikey</a>. Your profile's <em>Game details</em> must be Public or Steam returns nothing.</p>
    <label class="field">API key <input class="input" name="api_key" value="${esc(data("steam").api_key ?? "")}" required></label>
    <label class="field">SteamID <input class="input" name="steam_id" value="${esc(data("steam").steam_id ?? "")}" required></label>
    <button class="btn btn-primary" style="font-size:12px">Save</button>
  </form>`,
})}
${[
  ["gog", "GOG.com", GOG_AUTH_URL, "After signing in you land on a blank page — copy its whole address and paste it below."],
  ["epic", "Epic Games Store", EPIC_AUTH_URL, "After signing in you land on a page of JSON — copy all of it and paste it below. Epic's login expires every few weeks."],
]
  .map(([store, label, url, hint]) =>
    connectCard({
      store,
      label,
      row: by(store),
      counts: counts[store] ? `${counts[store]} titles` : "",
      action: by(store)?.data ? syncBtn(store, by(store)?.status === "needs_reauth" ? "Reconnect" : "Resync") : "",
      body: `<form method="post" action="/connect/${store}">
    <p class="intro" style="margin:0 0 8px"><a href="${url}" target="_blank" rel="noopener">Open the ${esc(label)} login</a>. ${hint}</p>
    <label class="field">Paste it here <input class="input" name="pasted" ${by(store)?.data ? "" : "required"}></label>
    <button class="btn btn-primary" style="font-size:12px">${by(store)?.data ? "Reconnect" : "Connect"}</button>
  </form>`,
    }),
  )
  .join("")}
${connectCard({
  store: "xbox",
  label: "Xbox",
  row: { status: "connected", last_synced_at: null },
  counts: counts.xbox ? `${counts.xbox} titles` : "",
  action: `<a class="btn btn-secondary" href="/xbox" style="font-size:12px">Edit</a>`,
  body: `<p class="intro" style="margin:0">No library API exists, so Play Anywhere titles are typed in by hand and nothing re-checks them.</p>`,
})}
${connectCard({
  store: "gfn",
  label: "GeForce NOW",
  row: by("gfn"),
  counts: counts.gfn ? `${counts.gfn} catalogue entries` : "",
  action: syncBtn("gfn", "Resync"),
  body: `<p class="intro" style="margin:0">Pentanet's Australian catalogue. No login needed. Support is per store — a game may stream from GOG but not Epic.</p>`,
})}
${connectCard({
  store: "igdb",
  label: "Scores & metadata",
  row: by("igdb"),
  counts: `${ratings.metacritic ?? 0} Metacritic · ${ratings.igdb ?? 0} IGDB aggregate`,
  action: `<form class="inline" method="post" action="/ratings"><button class="btn btn-secondary" style="font-size:12px">${
    pendingScores > 0 ? `Fetch ${Math.min(pendingScores, 250)} scores` : "Refresh scores"
  }</button></form>`,
  body: `<form method="post" action="/connect/igdb">
    <p class="intro" style="margin:0 0 8px">IGDB identifies games across stores and supplies art, genres and years. Register at <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener">dev.twitch.tv/console/apps</a>.${
      pendingScores > 0 ? ` <strong>${pendingScores} Steam games have no Metacritic score yet</strong> — Steam rate limits this, so it runs in batches.` : ""
    }</p>
    <label class="field">Client ID <input class="input" name="client_id" value="${esc(data("igdb").client_id ?? "")}" required></label>
    <label class="field">Client secret <input class="input" name="client_secret" type="password" value="${esc(data("igdb").client_secret ?? "")}" required></label>
    <button class="btn btn-primary" style="font-size:12px">Save</button>
  </form>`,
})}
</div>`;
};
