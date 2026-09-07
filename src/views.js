import { AUTH_URL as GOG_AUTH_URL } from "./gog.js";

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
  .store { font-size: .8rem; border: 1px solid; border-radius: .5rem; padding: 0 .4rem; margin-right: .25rem; }
</style>
<h1>Games Library</h1>
<nav><a href="/">Library</a><a href="/unmatched">Unmatched${pending ? ` (${pending})` : ""}</a><a href="/connect">Connect</a></nav>
${body}
`;

export const listPage = (games) =>
  games.length === 0
    ? `<p class="empty">No games yet. Connect a store and sync to fill this in.</p>`
    : `<table>
  <tr><th>Game</th><th>Stores</th></tr>
  ${games
    .map(
      (g) => `<tr>
    <td>${esc(g.title)}</td>
    <td>${g.stores.map((s) => `<span class="store">${esc(s)}</span>`).join("")}</td>
  </tr>`,
    )
    .join("\n  ")}
</table>`;

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
${gogFieldset(rows)}
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

export const gogFieldset = (rows) => {
  const gog = rows.find((r) => r.store === "gog");
  const connected = gog?.data && gog.status !== "needs_reauth";
  return `
<form method="post" action="/connect/gog">
  <fieldset>
    <legend>GOG</legend>
    <p class="hint">
      <a href="${GOG_AUTH_URL}" target="_blank" rel="noopener">Open the GOG login</a> in a new tab.
      After signing in you land on a blank page — copy its whole address from the URL bar and paste it below.
    </p>
    <label>Login URL (or just the code) <input name="pasted" placeholder="https://embed.gog.com/on_login_success?...code=..." ${connected ? "" : "required"}></label>
    <button>${connected ? "Reconnect" : "Connect"}</button>
    ${status(gog)}
  </fieldset>
</form>
${connected ? `<form method="post" action="/sync/gog"><button>Sync GOG</button></form>` : ""}`;
};
