import { AUTH_URL as GOG_AUTH_URL } from "./gog.js";
import { AUTH_URL as EPIC_AUTH_URL } from "./epic.js";

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const layout = (title, body, pending = 0) => `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Games Library</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
  .empty { opacity: .7; padding: 3rem 0; }
  nav { margin-bottom: 1.5rem; display: flex; gap: 1rem; }
  fieldset { border: 1px solid color-mix(in srgb, currentColor 25%, transparent); border-radius: .5rem; margin: 0 0 1rem; padding: 1rem; }
  label { display: block; margin: .5rem 0; }
  input { font: inherit; width: 100%; max-width: 28rem; padding: .3rem; }
  .status { font-size: .85rem; opacity: .75; }
  .error { color: #c00; font-size: .85rem; }
  .hint { font-size: .85rem; opacity: .75; margin: .25rem 0 .75rem; }
  .review { font-size: 1.3rem; margin: 1rem 0 .25rem; }
  .review small { display: block; font-size: .8rem; opacity: .7; font-weight: normal; }
  .actions { display: flex; gap: 1rem; align-items: center; margin-top: 1rem; }
  textarea { font: inherit; width: 100%; max-width: 40rem; min-height: 9rem; padding: .4rem; }
  td form { display: inline; }
  td button { font: inherit; font-size: .8rem; padding: 0 .4rem; }
  .store { display: inline-flex; align-items: center; gap: .1rem; margin-right: .45rem; vertical-align: middle; font-size: .85rem; }
  .store svg { display: block; border-radius: 50%; }
  .store.gfn svg { box-shadow: 0 0 0 2px #76b900; }
  .store .bolt { font-size: .85rem; margin-left: -.3rem; align-self: flex-end; }
  td { vertical-align: middle; }
  .merge { font-size: .75rem; opacity: 0; }
  tr:hover .merge { opacity: .7; }
  .filters { display: flex; gap: .75rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
  .filters input[type=search], .filters select { width: auto; font: inherit; padding: .3rem; }
</style>
<h1>Games Library</h1>
<nav><a href="/">Library</a><a href="/unmatched">Unmatched${pending ? ` (${pending})` : ""}</a><a href="/xbox">Xbox</a><a href="/connect">Connect</a></nav>
${body}
`;

const STORE_NAMES = { steam: "Steam", gog: "GOG", epic: "Epic", xbox: "Xbox" };

// Inline SVG so the page stays self-contained — no asset requests, nothing to
// go missing. These are simplified marks in each store's colour, not the
// official logos: recognisable by silhouette and colour at 18px, which is all
// a badge needs to do.
const STORE_ICONS = {
  steam: `<circle cx="12" cy="12" r="11" fill="#1b2838"/><circle cx="15.5" cy="8.5" r="3.6" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="8.2" cy="15.4" r="3.1" fill="#fff"/><path d="M5 15.4 15 8.5" stroke="#fff" stroke-width="1.4"/>`,
  gog: `<circle cx="12" cy="12" r="11" fill="#8b5cf6"/><path d="M15.4 8.6H9.8a1.6 1.6 0 0 0-1.6 1.6v3.6a1.6 1.6 0 0 0 1.6 1.6h5.6v-3.2h-3" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="square"/>`,
  epic: `<rect x="1" y="1" width="22" height="22" rx="5" fill="#2a2a2a"/><path d="M9 6.8h6.2M9 12h5M9 17.2h6.2M9 6.8v10.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
  xbox: `<circle cx="12" cy="12" r="11" fill="#107c10"/><path d="M7.4 6.6C9.8 9 14.2 15 16.6 17.4M16.6 6.6C14.2 9 9.8 15 7.4 17.4" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/>`,
};

// A badge names the Store; the green bolt marks that *this* Store's copy is
// confirmed streamable. Matching is by title for every Store but Steam, so no
// bolt means "not found in the catalogue", never "will not stream".
const badge = ({ store, status }) => {
  const name = STORE_NAMES[store] ?? store;
  const label = status
    ? `${name} — GeForce NOW: ${status}`
    : `${name} — not found in the GeForce NOW catalogue, may still stream`;
  const icon = STORE_ICONS[store];
  return `<span class="store${status === "AVAILABLE" ? " gfn" : ""}" title="${esc(label)}">${
    icon
      ? `<svg viewBox="0 0 24 24" width="28" height="28" role="img" aria-label="${esc(label)}">${icon}</svg>`
      : esc(name)
  }${status === "AVAILABLE" ? `<span class="bolt" aria-hidden="true">&#9889;</span>` : ""}</span>`;
};

export const listPage = (games, filters = {}) => `
<form class="filters" method="get" action="/">
  <input type="search" name="q" placeholder="Search titles" value="${esc(filters.q ?? "")}">
  <select name="store">
    <option value="">All stores</option>
    ${Object.entries(STORE_NAMES)
      .map(([v, l]) => `<option value="${v}"${filters.store === v ? " selected" : ""}>${l}</option>`)
      .join("")}
  </select>
  <label style="display:inline"><input type="checkbox" name="gfn" value="1" style="width:auto"${filters.gfn ? " checked" : ""}> Confirmed on GeForce NOW</label>
  <button>Filter</button>
  ${filters.q || filters.store || filters.gfn ? `<a href="/">Clear</a>` : ""}
</form>
${
  games.length === 0
    ? `<p class="empty">Nothing here. Connect a store and sync, or widen the filters.</p>`
    : `<p class="status">${games.length} game${games.length === 1 ? "" : "s"}.</p>
<table>
  <tr><th>Game</th><th>Stores</th><th></th></tr>
  ${games
    .map(
      (g) => `<tr>
    <td>${esc(g.title)}</td>
    <td>${g.stores.map(badge).join("")}</td>
    <td><a class="merge" href="/merge?from=${g.id}" title="Merge this into another game">merge</a></td>
  </tr>`,
    )
    .join("\n  ")}
</table>`
}`;

const STEAM_HINT = `Key from <a href="https://steamcommunity.com/dev/apikey">steamcommunity.com/dev/apikey</a>.
Your SteamID is the 17-digit number — and your profile's <em>Game details</em> must be set to Public,
or Steam silently returns nothing.`;

export const connectPage = (rows) => {
  const steam = rows.find((r) => r.store === "steam");
  return `
<form method="post" action="/connect/steam">
  <fieldset>
    <legend>Steam</legend>
    <p class="hint">${STEAM_HINT}</p>
    <label>API key <input name="api_key" value="${esc(steam?.data ? JSON.parse(steam.data).api_key : "")}" required></label>
    <label>SteamID <input name="steam_id" value="${esc(steam?.data ? JSON.parse(steam.data).steam_id : "")}" required></label>
    <button>Save</button>
    ${status(steam)}
  </fieldset>
</form>
${steam?.data ? `<form method="post" action="/sync/steam"><button>Sync Steam</button></form>` : ""}
${oauthFieldset(rows, "gog")}
${oauthFieldset(rows, "epic")}
<fieldset>
  <legend>Xbox</legend>
  <p class="hint">Xbox has no library API, so Play Anywhere titles are typed in by hand on the
    <a href="/xbox">Xbox page</a>. Nothing re-checks them.</p>
</fieldset>
${gfnFieldset(rows)}
${igdbFieldset(rows)}
`;
};

const status = (row) =>
  !row
    ? `<p class="status">Not connected.</p>`
    : row.last_error
      ? `<p class="error">${row.status === "needs_reauth" ? "Login expired. " : ""}${esc(row.last_error)}</p>`
      : `<p class="status">${row.last_synced_at ? `Last synced ${esc(row.last_synced_at)}` : "Connected, never synced."}</p>`;

export const igdbFieldset = (rows) => {
  const igdb = rows.find((r) => r.store === "igdb");
  const d = igdb?.data ? JSON.parse(igdb.data) : {};
  return `
<form method="post" action="/connect/igdb">
  <fieldset>
    <legend>IGDB</legend>
    <p class="hint">Identifies the same Game across Stores. Register an application at
      <a href="https://dev.twitch.tv/console/apps">dev.twitch.tv/console/apps</a> —
      IGDB authenticates through Twitch. Any OAuth redirect URL will do; it is never used.</p>
    <label>Client ID <input name="client_id" value="${esc(d.client_id ?? "")}" required></label>
    <label>Client secret <input name="client_secret" type="password" value="${esc(d.client_secret ?? "")}" required></label>
    <button>Save</button>
    ${igdb ? `<p class="status">Connected.</p>` : `<p class="status">Not connected — Games will be matched by title only.</p>`}
  </fieldset>
</form>`;
};

// One Entitlement at a time: the input is autofocused and Enter confirms, so a
// long tray is worked through from the keyboard alone.
export const unmatchedPage = (items, titles) => {
  if (items.length === 0)
    return `<p class="empty">Nothing to review — every Entitlement is either identified by IGDB or confirmed by you.</p>`;

  const [item, ...rest] = items;
  return `
<p class="status">${items.length} left to review.</p>
<form method="post" action="/unmatched">
  <input type="hidden" name="id" value="${item.id}">
  <p class="review">${esc(item.store_title)}<small>from ${esc(item.store)}</small></p>
  <label>Belongs to Game
    <input name="title" list="games" value="${esc(item.guess ?? item.store_title)}" autofocus required>
  </label>
  <p class="hint">Type an existing Game's title to merge this into it, or edit the title to split it out.</p>
  <div class="actions">
    <button>Confirm</button>
    ${rest.length ? `<a href="/unmatched?after=${item.id}">Skip</a>` : ""}
  </div>
</form>
<datalist id="games">${titles.map((t) => `<option value="${esc(t)}">`).join("")}</datalist>`;
};

const OAUTH_STORES = {
  gog: {
    label: "GOG",
    url: GOG_AUTH_URL,
    hint: "After signing in you land on a blank page — copy its whole address from the URL bar and paste it below.",
    placeholder: "https://embed.gog.com/on_login_success?...code=...",
  },
  epic: {
    label: "Epic",
    url: EPIC_AUTH_URL,
    hint: "After signing in you land on a page of JSON — copy all of it and paste it below. Epic's login expires every few weeks, so expect to redo this.",
    placeholder: '{"redirectUrl":"...","authorizationCode":"..."}',
  },
};

export const oauthFieldset = (rows, store) => {
  const { label, url, hint, placeholder } = OAUTH_STORES[store];
  const row = rows.find((r) => r.store === store);
  const connected = row?.data && row.status !== "needs_reauth";
  return `
<form method="post" action="/connect/${store}">
  <fieldset>
    <legend>${label}</legend>
    <p class="hint">
      <a href="${url}" target="_blank" rel="noopener">Open the ${label} login</a> in a new tab. ${hint}
    </p>
    <label>Paste it here <input name="pasted" placeholder="${esc(placeholder)}" ${connected ? "" : "required"}></label>
    <button>${connected ? "Reconnect" : "Connect"}</button>
    ${status(row)}
  </fieldset>
</form>
${connected ? `<form method="post" action="/sync/${store}"><button>Sync ${label}</button></form>` : ""}`;
};

export const gfnFieldset = (rows) => {
  const gfn = rows.find((r) => r.store === "gfn");
  return `
<fieldset>
  <legend>GeForce NOW</legend>
  <p class="hint">NVIDIA's Australian catalogue (the Pentanet alliance list), which differs from the
    global one. No login needed. Support is per store — a game may stream from GOG but not Epic.</p>
  <p class="hint">Source: Pentanet's own catalogue at cloud.gg — 2,200+ games. Matching is by title
    except on Steam, so a game with no badge may still stream; absence is not a no.</p>
  ${status(gfn)}
</fieldset>
<form method="post" action="/sync/gfn"><button>Sync GeForce NOW</button></form>`;
};

export const xboxPage = (items) => `
<p class="hint"><strong>Play Anywhere titles only</strong> — the ones with a PC build tied to the purchase.
  Console-only and cloud-only games do not belong here: they can be neither installed on this machine nor
  streamed through a PC store.</p>
<p class="hint">Xbox publishes no library API, so paste the titles here, one per line. Pasting the same list
  again is safe; titles are matched on paste, and anything IGDB recognises merges with your other stores
  automatically.</p>
<form method="post" action="/xbox/add">
  <textarea name="pasted" placeholder="Halo Infinite&#10;Forza Horizon 5&#10;Starfield" autofocus required></textarea>
  <div class="actions"><button>Add titles</button></div>
</form>
${
  items.length === 0
    ? `<p class="empty">No Xbox games yet.</p>`
    : `<p class="status">${items.length} Xbox game${items.length === 1 ? "" : "s"}.</p>
<table>
  <tr><th>Pasted title</th><th>Matched to</th><th></th></tr>
  ${items
    .map(
      (i) => `<tr>
    <td>${esc(i.store_title)}${i.gfn_status === "AVAILABLE" ? ` <span class="store gfn">&#9889;</span>` : ""}</td>
    <td>${i.game && i.game !== i.store_title ? esc(i.game) : ""}</td>
    <td><form method="post" action="/xbox/remove"><input type="hidden" name="id" value="${i.id}"><button>Remove</button></form></td>
  </tr>`,
    )
    .join("\n  ")}
</table>`
}`;

// The other half of the review tray: the tray catches merges that happened,
// this catches merges that should have.
export const mergePage = (from, titles) => `
<p class="review">${esc(from.title)}<small>merge this game into another</small></p>
<form method="post" action="/merge">
  <input type="hidden" name="from" value="${from.id}">
  <label>Into <input name="into" list="games" autofocus required placeholder="Start typing a game title"></label>
  <p class="hint">Its stores move onto the game you pick, and this row disappears. The decision is locked,
    so a later sync will not split them again. Pick an existing title — anything else is ignored.</p>
  <div class="actions"><button>Merge</button><a href="/">Cancel</a></div>
</form>
<datalist id="games">${titles.map((t) => `<option value="${esc(t)}">`).join("")}</datalist>`;
