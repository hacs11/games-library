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
  star: `<path d="M239.2 97.29a16 16 0 0 0-13.81-11L166 81.17l-23.28-55.36a15.95 15.95 0 0 0-29.44 0L90.07 81.17l-59.44 5.11a16 16 0 0 0-9.11 28.06l45.11 39.42-13.52 58.54a16 16 0 0 0 23.84 17.34l51-31 51.05 31a16 16 0 0 0 23.84-17.34l-13.53-58.6 45.1-39.36a16 16 0 0 0 4.79-17.15Z"/>`,
  // The outline is the unstarred state: a solid star on every tile read as
  // "already on your watchlist".
  "star-outline": `<path d="M239.18 97.26A16.38 16.38 0 0 0 224.92 86l-59-4.76-22.78-55.09a16.36 16.36 0 0 0-30.27 0L90.11 81.23 31.08 86a16.46 16.46 0 0 0-9.37 28.86l45 38.83L53 211.75a16.38 16.38 0 0 0 24.5 17.82l50.5-31 50.53 31A16.4 16.4 0 0 0 203 211.75l-13.76-58.07 45-38.83a16.43 16.43 0 0 0 4.94-17.59Zm-15.34 5.47-48.7 42a8 8 0 0 0-2.56 7.91l14.88 62.8a.37.37 0 0 1-.17.48c-.18.14-.23.11-.38 0l-54.72-33.65a8 8 0 0 0-8.38 0l-54.72 33.65c-.15.09-.2.12-.38 0a.37.37 0 0 1-.17-.48l14.88-62.8a8 8 0 0 0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l64-5.16a8 8 0 0 0 6.72-4.88l24.62-59.6c.08-.19.11-.26.35-.26s.27.07.35.26l24.62 59.6a8 8 0 0 0 6.72 4.88l64 5.16c.15 0 .24 0 .33.29s0 .4-.13.5Z"/>`,
  x: `<path d="m205.66 194.34-8 8a8 8 0 0 1-11.32 0L128 144.4l-58.34 57.94a8 8 0 0 1-11.32-11.32L116.28 133 58.34 74.66a8 8 0 0 1 11.32-11.32L128 121.6l58.34-57.94a8 8 0 0 1 11.32 11.32L139.72 133l57.94 58.34a8 8 0 0 1 0 3Z"/>`,
};

export const icon = (name, size = 15, style = "") =>
  `<svg viewBox="0 0 256 256" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" style="${style}"><use href="#icon-${name}"/></svg>`;

export const STORE_NAMES = { steam: "Steam", gog: "GOG", epic: "Epic", xbox: "Xbox" };
const STORE_LABELS = {
  steam: "Steam",
  gog: "GOG.com",
  epic: "Epic Games Store",
  xbox: "Xbox (Play Anywhere)",
};

// Each store's own mark, white on the brand's own colour: the paths are the
// official logos as published in Simple Icons (CC0; the trademarks remain each
// vendor's). Every one is a 24-unit glyph scaled to 60% and centred on the
// disc, so they sit at the same optical weight beside each other.
const STORE_ICONS = {
  steam: `<circle cx="12" cy="12" r="12" fill="#1b2838"/><path fill="#fff" transform="translate(4.8 4.8) scale(0.6)" d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>`,
  gog: `<circle cx="12" cy="12" r="12" fill="#86328A"/><path fill="#fff" transform="translate(4.8 4.8) scale(0.6)" d="M7.15 15.24H4.36a.4.4 0 0 0-.4.4v2c0 .21.18.4.4.4h2.8v1.32h-3.5c-.56 0-1.02-.46-1.02-1.03v-3.39c0-.56.46-1.02 1.03-1.02h3.48v1.32zM8.16 11.54c0 .58-.47 1.05-1.05 1.05H2.63v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4H4.39a.4.4 0 0 0-.41.4v2.02c0 .23.18.4.4.4H6v1.35H3.68c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04H7.1c.58 0 1.05.47 1.05 1.04v5.86zM21.36 19.36h-1.32v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.42c0-.56.46-1.02 1.03-1.02h5.61v5.44zM21.37 11.54c0 .58-.47 1.05-1.05 1.05h-4.48v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4h-2.03a.4.4 0 0 0-.4.4v2.02c0 .23.18.4.4.4h1.62v1.35H16.9c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04h3.43c.58 0 1.05.47 1.05 1.04v5.86zM13.72 4.64h-3.44c-.58 0-1.04.47-1.04 1.04v3.44c0 .58.46 1.04 1.04 1.04h3.44c.57 0 1.04-.46 1.04-1.04V5.68c0-.57-.47-1.04-1.04-1.04m-.3 1.75v2.02a.4.4 0 0 1-.4.4h-2.03a.4.4 0 0 1-.4-.4V6.4c0-.22.17-.4.4-.4H13c.23 0 .4.18.4.4zM12.63 13.92H9.24c-.57 0-1.03.46-1.03 1.02v3.39c0 .57.46 1.03 1.03 1.03h3.39c.57 0 1.03-.46 1.03-1.03v-3.39c0-.56-.46-1.02-1.03-1.02m-.3 1.72v2a.4.4 0 0 1-.4.4v-.01H9.94a.4.4 0 0 1-.4-.4v-1.99c0-.22.18-.4.4-.4h2c.22 0 .4.18.4.4zM23.49 1.1a1.74 1.74 0 0 0-1.24-.52H1.75A1.74 1.74 0 0 0 0 2.33v19.34a1.74 1.74 0 0 0 1.75 1.75h20.5A1.74 1.74 0 0 0 24 21.67V2.33c0-.48-.2-.92-.51-1.24m0 20.58a1.23 1.23 0 0 1-1.24 1.24H1.75A1.23 1.23 0 0 1 .5 21.67V2.33a1.23 1.23 0 0 1 1.24-1.24h20.5a1.24 1.24 0 0 1 1.24 1.24v19.34z"/>`,
  epic: `<circle cx="12" cy="12" r="12" fill="#313131"/><path fill="#fff" transform="translate(4.8 4.8) scale(0.6)" d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44a4.262 4.262 0 00.02.433c.031.3.037.59.316.92.027.033.311.245.311.245.153.075.258.13.43.2l8.335 3.491c.433.199.614.276.928.27h.002c.314.006.495-.071.928-.27l8.335-3.492c.172-.07.277-.124.43-.2 0 0 .284-.211.311-.243.28-.33.285-.621.316-.92a4.261 4.261 0 00.02-.434V1.879c0-1.373-.506-1.88-1.878-1.88zm13.366 3.11h.68c1.138 0 1.688.553 1.688 1.696v1.88h-1.374v-1.8c0-.369-.17-.54-.523-.54h-.235c-.367 0-.537.17-.537.539v5.81c0 .369.17.54.537.54h.262c.353 0 .523-.171.523-.54V8.619h1.373v2.143c0 1.144-.562 1.71-1.7 1.71h-.694c-1.138 0-1.7-.566-1.7-1.71V4.82c0-1.144.562-1.709 1.7-1.709zm-12.186.08h3.114v1.274H6.117v2.603h1.648v1.275H6.117v2.774h1.74v1.275h-3.14zm3.816 0h2.198c1.138 0 1.7.564 1.7 1.708v2.445c0 1.144-.562 1.71-1.7 1.71h-.799v3.338h-1.4zm4.53 0h1.4v9.201h-1.4zm-3.13 1.235v3.392h.575c.354 0 .523-.171.523-.54V4.965c0-.368-.17-.54-.523-.54zm-3.74 10.147a1.708 1.708 0 01.591.108 1.745 1.745 0 01.49.299l-.452.546a1.247 1.247 0 00-.308-.195.91.91 0 00-.363-.068.658.658 0 00-.28.06.703.703 0 00-.224.163.783.783 0 00-.151.243.799.799 0 00-.056.299v.008a.852.852 0 00.056.31.7.7 0 00.157.245.736.736 0 00.238.16.774.774 0 00.303.058.79.79 0 00.445-.116v-.339h-.548v-.565H7.37v1.255a2.019 2.019 0 01-.524.307 1.789 1.789 0 01-.683.123 1.642 1.642 0 01-.602-.107 1.46 1.46 0 01-.478-.3 1.371 1.371 0 01-.318-.455 1.438 1.438 0 01-.115-.58v-.008a1.426 1.426 0 01.113-.57 1.449 1.449 0 01.312-.46 1.418 1.418 0 01.474-.309 1.58 1.58 0 01.598-.111 1.708 1.708 0 01.045 0zm11.963.008a2.006 2.006 0 01.612.094 1.61 1.61 0 01.507.277l-.386.546a1.562 1.562 0 00-.39-.205 1.178 1.178 0 00-.388-.07.347.347 0 00-.208.052.154.154 0 00-.07.127v.008a.158.158 0 00.022.084.198.198 0 00.076.066.831.831 0 00.147.06c.062.02.14.04.236.061a3.389 3.389 0 01.43.122 1.292 1.292 0 01.328.17.678.678 0 01.207.24.739.739 0 01.071.337v.008a.865.865 0 01-.081.382.82.82 0 01-.229.285 1.032 1.032 0 01-.353.18 1.606 1.606 0 01-.46.061 2.16 2.16 0 01-.71-.116 1.718 1.718 0 01-.593-.346l.43-.514c.277.223.578.335.9.335a.457.457 0 00.236-.05.157.157 0 00.082-.142v-.008a.15.15 0 00-.02-.077.204.204 0 00-.073-.066.753.753 0 00-.143-.062 2.45 2.45 0 00-.233-.062 5.036 5.036 0 01-.413-.113 1.26 1.26 0 01-.331-.16.72.72 0 01-.222-.243.73.73 0 01-.082-.36v-.008a.863.863 0 01.074-.359.794.794 0 01.214-.283 1.007 1.007 0 01.34-.185 1.423 1.423 0 01.448-.066 2.006 2.006 0 01.025 0zm-9.358.025h.742l1.183 2.81h-.825l-.203-.499H8.623l-.198.498h-.81zm2.197.02h.814l.663 1.08.663-1.08h.814v2.79h-.766v-1.602l-.711 1.091h-.016l-.707-1.083v1.593h-.754zm3.469 0h2.235v.658h-1.473v.422h1.334v.61h-1.334v.442h1.493v.658h-2.255zm-5.3.897l-.315.793h.624zm-1.145 5.19h8.014l-4.09 1.348z"/>`,
  xbox: `<circle cx="12" cy="12" r="12" fill="#107C10"/><path fill="#fff" transform="translate(4.8 4.8) scale(0.6)" d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.002 17.48 24 14.861 24 12.004c0-3.34-1.365-6.362-3.57-8.536 0 0-.027-.022-.082-.042-.063-.022-.152-.045-.281-.045-.592 0-1.985.434-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042C1.365 5.642 0 8.664 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.82-2.813-4.216-3.245-4.806-3.245-.131 0-.223.021-.281.046v-.002zM12 3.551S9.055 1.828 6.755 1.746c-.903-.033-1.454.295-1.521.339C7.379.646 9.659 0 11.984 0H12c2.334 0 4.605.646 6.766 2.085-.068-.046-.615-.372-1.52-.339C14.946 1.828 12 3.545 12 3.545v.006z"/>`,
};

// Every mark and icon is defined once per page and referenced by id. Inlined,
// their paths were repeated on every tile, pill and price tag — 844 copies,
// 800KB of a 1.09MB Discover page.
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${[
  ...Object.entries(STORE_ICONS).map(([store, body]) => `<symbol id="mark-${store}" viewBox="0 0 24 24">${body}</symbol>`),
  ...Object.entries(ICONS).map(([name, body]) => `<symbol id="icon-${name}" viewBox="0 0 256 256">${body}</symbol>`),
].join("")}</svg>`;

export const storeMark = (store, size = 13) =>
  STORE_ICONS[store]
    ? `<svg viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${esc(STORE_LABELS[store] ?? store)}" style="border-radius:50%;display:block"><use href="#mark-${store}"/></svg>`
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
  .quick-views { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
  .quick-view {
    display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; text-decoration: none; color: inherit;
    border-radius: var(--radius-md); background: var(--color-surface); box-shadow: var(--shadow-sm);
  }
  .quick-view:hover { box-shadow: 0 0 0 1px var(--color-neutral-600); }
  .quick-view.on { background: var(--color-accent-900); box-shadow: inset 0 0 0 1px var(--color-accent); }
  .quick-view strong { display: flex; align-items: center; gap: 8px; font-size: 26px; font-weight: 500; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
  .quick-view > span { font-size: 13px; color: color-mix(in srgb, var(--color-text) 62%, transparent); }
  .quick-view.on > span { color: var(--color-accent-300); }
  @media (max-width: 720px) { .quick-views { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .discover-filters .search-wrap { max-width: none; }
  .discover-summary {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-bottom: 12px;
    font-size: 13px; color: color-mix(in srgb, var(--color-text) 62%, transparent);
  }
  .discover-summary-links { display: flex; gap: 16px; white-space: nowrap; }
  .discover-summary .gfn-toggle { border: 0; padding: 0; color: var(--color-accent); }
  .score-range { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: color-mix(in srgb, var(--color-text) 62%, transparent); }
  .score-range input[type=range] { width: 92px; accent-color: var(--color-accent); }
  /* The readout changes text on every drag step ("any", "5", "95"). Without a
     floor it resizes the flex row and every filter after it twitches. */
  .score-range output { display: inline-block; min-width: 3.5ch; text-align: left; font-variant-numeric: tabular-nums; }
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
  /* Discover tiles are Library tiles with a star over the cover and a discount
     where the score sits. */
  .tile-wrap { position: relative; }
  /* Two signals can land in the same corner — a discount at this store and a
     cheapest-anywhere at its all-time low — so the corner is a row, not a
     slot. */
  .deal-stack { position: absolute; bottom: 7px; right: 7px; display: flex; gap: 4px; }
  .deal-badge {
    padding: 2px 6px; border-radius: 6px;
    font-size: 10px; font-variant-numeric: tabular-nums;
    background: var(--color-accent-800); color: var(--color-accent-100);
  }
  /* Inverted rather than accented: the Market Low names no Store, so it must
     not read as the store discount beside it (docs/adr/0006). */
  .low-badge {
    padding: 2px 6px; border-radius: 6px; font-size: 10px; letter-spacing: 0.04em;
    background: var(--color-neutral-100); color: var(--color-bg);
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

  /* A filter or a POST's 303 is a full navigation. Chrome holds the new
     document's first paint until the transition is ready, so the list does not
     paint at the top and jump once the scroll is restored — it cross-fades. */
  @view-transition { navigation: auto; }
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
  }
  @media (max-width: 640px) { .table-wrap { overflow-x: auto; } }
</style>
${SPRITE}
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

  addEventListener("click", (e) => {
    const link = e.target.closest?.("a[data-keep-scroll]");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    // Opening or closing a panel swaps only the panel: the list, its scroll and
    // its images stay put. The URL still changes, so it stays linkable and the
    // back button still closes it.
    e.preventDefault();
    history.pushState(null, "", link.href);
    showPanel(link.hasAttribute("data-close") || link.classList.contains("scrim") ? "" : null);
  });
  addEventListener("popstate", () => showPanel(null));
  let opener;
  async function showPanel(markup) {
    const url = location.href;
    if (markup === null) {
      markup = await fetch(url, { headers: { "x-panel": "1" } }).then((r) => r.text()).catch(() => location.reload());
      if (markup === undefined || url !== location.href) return;  // reloading, or clicked on before this arrived
    }
    document.querySelectorAll(".scrim, .panel").forEach((el) => el.remove());
    document.body.insertAdjacentHTML("beforeend", markup);
    const panel = document.querySelector(".panel");
    if (panel) {
      opener ??= document.activeElement;
      panel.querySelector("[data-close]").focus();
    } else {
      opener?.focus({ preventScroll: true });
      opener = null;
    }
  }
  // Every POST here 303s back to a list: to its own back URL where it carries
  // one (starring), otherwise to the page the form is on (Connect's buttons).
  addEventListener("submit", (e) => {
    const back = e.target.elements.back;
    sessionStorage.setItem(back ? new URL(back.value, location).href : location.href, scrollY);
  });
  // A refresh runs in the background: follow it, and reload once it is done so
  // the page shows what it fetched.
  if (document.querySelector("[data-job]")) {
    (async function poll() {
      const jobs = await fetch("/jobs").then((r) => r.json()).catch(() => null);
      if (!jobs) return setTimeout(poll, 2000);  // server restarting: keep watching
      for (const el of document.querySelectorAll("[data-job]")) {
        const job = jobs[el.dataset.job];
        if (!job) return location.reload();
        el.querySelector("[data-job-label]").textContent = job.label;
        Object.assign(el.querySelector("progress"), { value: job.value, max: job.max });
      }
      setTimeout(poll, 2000);
    })();
  }

  const parked = sessionStorage.getItem(location.href);
  if (parked !== null) {
    sessionStorage.removeItem(location.href);
    scrollTo(0, +parked);
  }
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

// Score ≥ N, shared by Library and Discover. `<output>` is the element the
// platform provides for exactly this, so the live number needs no script block
// and no id lookup — just the one handler the range fires as it is dragged.
// The value still only filters on Apply; this is the readout, not the filter.
const scoreRange = (minScore) => {
  const v = Number(minScore) || 0;
  return `<span class="score-range">
    <span>Score ≥ <output>${v || "any"}</output></span>
    <input type="range" name="minScore" min="0" max="95" step="5" value="${v}"
           oninput="this.closest('.score-range').querySelector('output').value = this.value === '0' ? 'any' : this.value">
  </span>`;
};

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

// A studio list runs to hundreds of names, which is unreadable as a <select>.
// A datalist is the same markup cost but types ahead, and an unknown name just
// matches nothing.
const studioFilter = (studios, value = "") => `
  <input class="input" name="studio" list="studios" placeholder="Any studio" style="min-width:150px" value="${esc(value)}">
  <datalist id="studios">${studios.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`;

// Every filter's default is "unset", so clearing them is just the bare path.
// `view` is a display preference, not a filter, and survives the reset; how
// much of the list is shown is neither, and is not a reason to offer one.
const clearLink = (path, filters, keep = {}) =>
  qs({ ...filters, ...keep, view: "", limit: "" }) ? `<a class="gfn-toggle" href="${path}${qs(keep)}">Clear filters</a>` : "";

export const listPage = (games, filters = {}, opts = {}) => {
  const { hidden = 0, stale = [], genres = [], studios = [], total = 0, view = "grid", matching = 0 } = opts;
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
  ${studioFilter(studios, filters.studio)}
  <select class="input" name="sort" style="min-width:124px">
    <option value="">A–Z</option>
    <option value="rating"${filters.sort === "rating" ? " selected" : ""}>Highest score</option>
    <option value="year"${filters.sort === "year" ? " selected" : ""}>Newest</option>
  </select>
  <a class="gfn-toggle${filters.gfn ? " on" : ""}" href="/${qs(filters, { gfn: !filters.gfn, view: "" })}">
    ${icon("lightning", 14)} GeForce NOW only
  </a>
  ${scoreRange(filters.minScore)}
  ${filters.all || hidden ? `<label style="font-size:12px" class="muted"><input type="checkbox" name="all" value="1"${filters.all ? " checked" : ""}> ${hidden} hidden</label>` : ""}
  <button class="btn btn-secondary">Apply</button>
  ${clearLink("/", filters, { view })}
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
    (g) => `<a class="tile" data-keep-scroll href="/${qs(filters, { view, game: g.id })}">
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
    <td style="padding:9px 8px"><a class="row-link" data-keep-scroll href="/${qs(filters, { view, game: g.id })}">
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
  const meta = [game.studio, game.year, game.rating != null ? `${game.rating} score` : "No score", hours(game.playtime_minutes)];
  return `
<a class="scrim" data-keep-scroll href="${esc(closeHref)}" aria-label="Close"></a>
<aside class="panel" role="dialog" aria-modal="true" aria-label="${esc(game.title)}">
  <div class="panel-close"><a class="btn btn-secondary btn-icon" data-close data-keep-scroll href="${esc(closeHref)}" aria-label="Close">${icon("x", 15)}</a></div>
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

// A star is a form, and a form cannot live inside the <a> that is the card —
// so it sits over it instead, in a relative wrapper.
const starForm = (item, back, attrs = "") => `<form class="inline" method="post" action="/watch"${attrs}>
  <input type="hidden" name="title" value="${esc(item.norm_title)}">
  <input type="hidden" name="back" value="${esc(back)}">
  <button class="btn btn-secondary btn-icon" style="padding:5px;${item.watched ? "color:var(--color-accent);border-color:var(--color-accent)" : ""}"
    title="${item.watched ? "In your watchlist — click to remove" : "Add to watchlist"}"
    aria-label="${item.watched ? "Remove from watchlist" : "Add to watchlist"}">${icon(item.watched ? "star" : "star-outline", 14)}</button>
</form>`;

// The Stores whose own catalogue we can read a price out of.
const PRICE_STORES = ["steam", "gog", "xbox"];

const SCORE_STEPS = [0, 50, 60, 70, 75, 80, 85, 90];

const count = (n) => (n == null ? "–" : n.toLocaleString("en-AU"));

// A quick view is one toggle filter shown with how many titles it holds;
// "Everything" is all three off.
const quickView = (filters, key, n, label, extra = "") => {
  const on = key ? filters[key] : !filters.sale && !filters.low && !filters.watch;
  const href = key ? qs({ ...filters, [key]: !filters[key] }) : qs({ ...filters, sale: false, low: false, watch: false });
  return `<a class="quick-view${on ? " on" : ""}" href="/discover${href}"${on ? ` aria-current="true"` : ""}${extra}>
    <strong>${count(n)}${key === "low" ? ` <span class="low-badge">ATL</span>` : ""}</strong>
    <span>${label}</span>
  </a>`;
};

export const discoverPage = (games, filters = {}, total = 0, tallies = {}, genres = [], studios = []) => `
${title("Discover", { count: "GeForce NOW · Australia · not owned" })}
<nav class="quick-views" aria-label="Quick views">
  ${quickView(filters, "", tallies.all ?? total, "Everything that streams")}
  ${quickView(filters, "sale", tallies.sale, "On sale now")}
  ${quickView(filters, "low", tallies.low, "At an all-time low",
    ` title="The cheapest retail price anywhere is at its all-time low. gg.deals doesn't say which store — check it streams."`)}
  ${quickView(filters, "watch", tallies.watch, "On your watchlist")}
</nav>
<form class="filters discover-filters" method="get" action="/discover" onchange="this.requestSubmit()">
  ${["sale", "low", "watch"].map((k) => (filters[k] ? `<input type="hidden" name="${k}" value="1">` : "")).join("")}
  ${filters.limit ? `<input type="hidden" name="limit" value="${esc(filters.limit)}">` : ""}
  <span class="search-wrap">
    ${icon("search", 15)}
    <input class="input" type="search" name="q" placeholder="Search ${count(tallies.all ?? total)} titles" value="${esc(filters.q ?? "")}">
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
  <select class="input" name="genre" style="min-width:140px">
    <option value="">All genres</option>
    ${genres.map((g) => `<option value="${esc(g)}"${filters.genre === g ? " selected" : ""}>${esc(g)}</option>`).join("")}
  </select>
  ${studioFilter(studios, filters.studio)}
  <select class="input" name="minScore" aria-label="Minimum score" style="min-width:110px">
    ${[...new Set([...SCORE_STEPS, Number(filters.minScore) || 0])]
      .sort((a, b) => a - b)
      .map((v) => `<option value="${v}"${(Number(filters.minScore) || 0) === v ? " selected" : ""}>${v ? `Score ${v}+` : "Any score"}</option>`)
      .join("")}
  </select>
  <select class="input" name="sort" aria-label="Sort" style="min-width:150px">
    <option value="">A–Z</option>
    <option value="discount"${filters.sort === "discount" ? " selected" : ""}>Biggest discount</option>
    <option value="saving"${filters.sort === "saving" ? " selected" : ""}>Biggest saving</option>
    <option value="price"${filters.sort === "price" ? " selected" : ""}>Price: low to high</option>
    <option value="rating"${filters.sort === "rating" ? " selected" : ""}>Highest score</option>
  </select>
</form>
<div class="discover-summary">
  <span>${games.length < total ? `showing ${games.length} of ${count(total)} titles` : `${count(total)} titles`} · prices from Steam, GOG and Xbox in AUD · all-time lows by <a href="https://gg.deals/" target="_blank" rel="noopener">gg.deals</a></span>
  <span class="discover-summary-links">${clearLink("/discover", filters)}${
    games.length < total ? `<a href="/discover${qs({ ...filters, limit: "all" })}">Show all</a>` : ""
  }</span>
</div>
<hr class="rule-fade" style="margin-bottom:22px">
${
  games.length === 0
    ? `<p class="empty">No titles match those filters.</p>`
    : `<div class="grid">
${games.map((g) => discoverTile(g, filters)).join("\n")}
</div>`
}
${
  games.length < total
    ? `<p class="empty" style="padding:34px 0"><a href="/discover${qs({ ...filters, limit: "all" })}">Show all ${total}</a></p>`
    : ""
}`;

// The Library's tile, with what Discover knows instead of what ownership knows:
// every one of these streams, so GFN is a given rather than a badge worth
// earning, the discount takes the score's corner, and the score moves left.
const discoverTile = (g, filters) => `<div class="tile-wrap">
${starForm(g, `/discover${qs(filters)}`, ` style="position:absolute;top:7px;left:7px;z-index:1"`)}
<a class="tile" data-keep-scroll href="/discover${qs({ ...filters, title: g.norm_title })}">
  ${coverArt(g)}
    ${g.rating != null ? `<span class="score-badge" style="right:auto;left:7px" title="Metacritic ${g.rating}">${g.rating}</span>` : ""}
    <span class="deal-stack">
      ${g.at_retail_low ? `<span class="low-badge" title="Cheapest retail price anywhere is at its all-time low — gg.deals does not say which store, so check it streams">ATL</span>` : ""}
      ${g.best_discount > 0 ? `<span class="deal-badge" title="Best discount across the stores selling it">−${g.best_discount}%</span>` : ""}
    </span>
  </div>
  <span class="tile-title">${esc(g.title)}</span>
  <span class="tile-genres">${esc((g.genres ?? "").split(", ").slice(0, 3).join(", "))}</span>
  ${g.prices.length ? `<span class="pills">${priceTags(g.prices)}</span>` : ""}
  <span class="pills">${g.stores
    .map((s) => storePill({ store: CATALOGUE_STORES[s] ?? s }))
    .join("")}</span>
</a></div>`;

// Market Lows are stored as cents and a currency code, unlike a Store price,
// which arrives already formatted by the Store itself.
const money = (c, currency = "AUD") =>
  c == null ? null : `${currency === "AUD" ? "A$" : `${currency} `}${(c / 100).toFixed(2)}`;

const priceTags = (prices = []) =>
  prices
    .map(
      (p) => `<span class="tag tag-neutral" style="font-variant-numeric:tabular-nums" title="${esc(
        `${STORE_NAMES[p.store] ?? p.store} price, AUD`,
      )}">${storeMark(p.store, 10)} ${esc(p.formatted)}</span>`,
    )
    .join("");

// Cheapest anywhere, from gg.deals — a figure of its own, below the store rows
// and never inside one, because the free tier does not say which store it came
// from and a price with no store cannot be the one that streams (docs/adr/0006,
// and docs/adr/0003 for why that matters). The link is also the attribution
// gg.deals requires wherever its data is shown.
const marketLow = (item) => {
  const m = item.market;
  if (!m) return "";
  // Only Retail carries the ATL mark, and only on the same terms the tile's
  // does — `at_retail_low`, not a comparison of its own, so the panel cannot
  // say ATL about a title the grid does not mark.
  const row = (label, now, low, hint, mark = false) =>
    now == null
      ? ""
      : `<div class="own-row">
    <span class="own-mark"></span>
    <span style="font-size:13px" title="${esc(hint)}">${label}</span>
    <span class="own-detail" style="font-variant-numeric:tabular-nums">${esc(money(now, m.currency))}${
      low == null ? "" : ` <span class="muted">· low ${esc(money(low, m.currency))}</span>`
    }${mark && item.at_retail_low ? ` <span class="low-badge">ATL</span>` : ""}</span>
  </div>`;
  return `
  <h6 style="margin-top:20px">Cheapest anywhere</h6>
  ${row("Retail", m.retail, m.retail_low, "Lowest official store price gg.deals can see, and its all-time low", true)}
  ${row("Keyshop", m.keyshop, m.keyshop_low, "Lowest keyshop price — a reseller of keys, not a store that grants an entitlement")}
  <p class="muted" style="font-size:11px;margin:10px 0 0">Which store this is from is not published on the free tier, so it is not a price for any row above — check it streams before buying. Prices by <a href="${esc(
    m.url ?? "https://gg.deals/",
  )}" target="_blank" rel="noopener">gg.deals</a>.</p>`;
};

// The Discover panel is keyed by normalised title, not a Game id: these are
// catalogue entries you do not own, so there is no Game row behind them.
export const discoverPanel = (item, closeHref) => {
  if (!item) return "";
  const cheapest = item.prices.toSorted((a, b) => (a.cents ?? Infinity) - (b.cents ?? Infinity));
  return `
<a class="scrim" data-keep-scroll href="${esc(closeHref)}" aria-label="Close"></a>
<aside class="panel" role="dialog" aria-modal="true" aria-label="${esc(item.title)}">
  <div class="panel-close"><a class="btn btn-secondary btn-icon" data-close data-keep-scroll href="${esc(closeHref)}" aria-label="Close">${icon("x", 15)}</a></div>
  <div class="cover" style="width:132px">${
    item.cover_url
      ? `<img src="${esc(item.cover_url)}" alt="">`
      : `<span class="cover-mono" style="font-size:26px">${esc(initials(item.title))}</span>`
  }</div>
  <h3>${esc(item.title)}</h3>
  <div class="panel-meta">${[item.studio, item.year].filter(Boolean).map((v) => `${esc(String(v))} · `).join("")}Not owned${
    item.rating != null
      ? ` · ${item.rating_url ? `<a href="${esc(item.rating_url)}" target="_blank" rel="noopener">${item.rating} Metacritic</a>` : `${item.rating} Metacritic`}`
      : ""
  }${item.best_discount > 0 ? ` · on sale, up to −${item.best_discount}%` : ""}</div>
  <div class="panel-tags">${(item.genres ?? "")
    .split(", ")
    .filter(Boolean)
    .map((t) => `<span class="tag tag-neutral">${esc(t)}</span>`)
    .join("")}</div>
  <hr>
  <h6>Buy it on</h6>
  ${item.stores
    .map((raw) => {
      const store = CATALOGUE_STORES[raw] ?? raw;
      const price = item.prices.find((p) => p.store === store);
      return `<div class="own-row">
    <span class="own-mark">${storeMark(store, 16)}</span>
    <span style="font-size:13px">${esc(STORE_LABELS[store] ?? STORE_NAMES[store] ?? store)}</span>
    <span class="own-detail" style="font-variant-numeric:tabular-nums">${
      price
        ? `${price.discount > 0 ? `<span style="color:var(--color-accent)">−${price.discount}%</span> ` : ""}${esc(price.formatted)}`
        : `<span class="muted">No price</span>`
    }</span>
  </div>`;
    })
    .join("")}
  ${
    item.prices.length < item.stores.length
      ? `<p class="muted" style="font-size:11px;margin:10px 0 0">Only Steam, GOG and Xbox publish prices we can read. The rest stream all the same.</p>`
      : ""
  }
  ${marketLow(item)}
  <h6 style="margin-top:20px">GeForce NOW</h6>
  <div class="gfn-row">
    <span style="color:#a3d95a">${icon("lightning", 15)}</span>
    <span style="color:#a3d95a">In the Australian catalogue via ${item.stores
      .map((raw) => esc(STORE_NAMES[CATALOGUE_STORES[raw] ?? raw] ?? raw))
      .join(", ")}</span>
  </div>
  <p class="muted" style="font-size:11px;margin:8px 0 0">Support is per store — buy it on a store listed above, or it will not stream.</p>
  <div class="panel-actions">
    ${starForm(item, `${closeHref}${closeHref.includes("?") ? "&" : "?"}title=${encodeURIComponent(item.norm_title)}`)}
    <a class="btn btn-primary" href="https://play.geforcenow.com/" target="_blank" rel="noopener">Open GeForce NOW</a>
    ${cheapest[0] ? `<a class="btn btn-secondary" href="${esc(catalogueUrl(cheapest[0].store, item.title))}" target="_blank" rel="noopener">Open store page</a>` : ""}
  </div>
</aside>`;
};

// No product ids on the catalogue side, so these are searches by title.
const catalogueUrl = (store, title) => {
  const q = encodeURIComponent(title);
  return {
    steam: `https://store.steampowered.com/search/?term=${q}`,
    gog: `https://www.gog.com/en/games?query=${q}`,
    xbox: `https://www.xbox.com/en-AU/Search/Results?q=${q}`,
  }[store] ?? "#";
};

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

// While a refresh runs, its bar stands where its button was. data-job is what
// the poller in the layout looks for.
const jobBar = (name, job) => `<span data-job="${name}" style="display:flex;align-items:center;gap:8px;font-size:12px">
  <span data-job-label class="muted">${esc(job.label)}</span>
  <progress value="${job.value}" max="${job.max}" style="width:120px;height:6px"></progress>
</span>`;

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

// A saved secret is never rendered back: the field comes back empty, and blank
// on submit means "keep the one that is saved". Identifiers (SteamID, client
// ID) are not secrets and stay visible — they are how you tell accounts apart.
const secretField = (label, name, saved) =>
  `<label class="field">${label} <input class="input" name="${name}" type="password" value=""
    placeholder="${saved ? "Saved — leave blank to keep" : ""}"${saved ? "" : " required"}></label>`;

export const connectPage = (rows, pendingScores = 0, ratings = {}, counts = {}) => {
  const running = counts.running ?? {};
  const by = (s) => rows.find((r) => r.store === s);
  const data = (s) => {
    const r = by(s);
    return r?.data ? JSON.parse(r.data) : {};
  };
  const syncBtn = (s, label = "Resync") =>
    running[`sync-${s}`]
      ? jobBar(`sync-${s}`, running[`sync-${s}`])
      : `<form class="inline" method="post" action="/sync/${s}"><button class="btn btn-secondary" style="font-size:12px">${label}</button></form>`;

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
    ${secretField("API key", "api_key", data("steam").api_key)}
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
  store: "steam",
  label: "Catalogue prices",
  row: {
    status: PRICE_STORES.some((s) => counts.prices?.[s]?.priced) ? "connected" : undefined,
    last_synced_at: counts.prices?.fetched,
  },
  counts: PRICE_STORES.some((s) => counts.prices?.[s]?.priced)
    ? [
        ...PRICE_STORES.map((s) => `${STORE_NAMES[s]} ${counts.prices[s].priced} priced · ${counts.prices[s].onSale} on sale`),
        counts.prices?.market?.priced ? `gg.deals ${counts.prices.market.priced} market lows` : "",
      ]
        .filter(Boolean)
        .join(" — ")
    : "not fetched yet",
  action: running.prices
    ? jobBar("prices", running.prices)
    : `<form class="inline" method="post" action="/prices"><button class="btn btn-secondary" style="font-size:12px">Refresh prices</button></form>`,
  body: `<p class="intro" style="margin:0 0 10px">Steam, GOG and Xbox prices in AUD for the Discover catalogue, resolved by title against each store's own catalogue. Xbox covers Play Anywhere titles only, the same rule your Xbox library follows. Epic publishes a list price but no discount, so its titles show no price. Takes a couple of minutes.</p>
  <form method="post" action="/connect/ggdeals">
    <p class="intro" style="margin:0 0 8px">A <a href="https://gg.deals/api/" target="_blank" rel="noopener">gg.deals</a> key adds a market low — cheapest anywhere and its all-time low — to the detail panel, including for titles no store here prices. It names no store, so it is never one of the store prices above. Free for personal use; generate a key in your gg.deals settings.</p>
    ${secretField("gg.deals API key", "key", data("ggdeals").key)}
    <button class="btn btn-primary" style="font-size:12px">Save</button>
  </form>`,
})}
${connectCard({
  store: "igdb",
  label: "Scores & metadata",
  // IGDB's own credential row is never synced through syncStore; what dates
  // this card is the last score that was fetched.
  row: { ...by("igdb"), last_synced_at: ratings.fetched ?? by("igdb")?.last_synced_at },
  counts: `${ratings.metacritic ?? 0} Metacritic · ${ratings.igdb ?? 0} IGDB aggregate`,
  action: running.ratings
    ? jobBar("ratings", running.ratings)
    : `<form class="inline" method="post" action="/ratings"><button class="btn btn-secondary" style="font-size:12px">${
        pendingScores > 0 ? `Fetch ${pendingScores} scores` : "Refresh scores"
      }</button></form>`,
  body: `<form method="post" action="/connect/igdb">
    <p class="intro" style="margin:0 0 8px">IGDB identifies games across stores and supplies art, genres and years. Register at <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener">dev.twitch.tv/console/apps</a>.${
      pendingScores > 0 ? ` <strong>${pendingScores} Steam titles have no Metacritic score yet</strong> (yours first, then Discover's) — Steam allows about 200 every five minutes, so one press works through them all, waiting out the limit as it goes.` : ""
    }</p>
    <label class="field">Client ID <input class="input" name="client_id" value="${esc(data("igdb").client_id ?? "")}" required></label>
    ${secretField("Client secret", "client_secret", data("igdb").client_secret)}
    <button class="btn btn-primary" style="font-size:12px">Save</button>
  </form>`,
})}
</div>`;
};
