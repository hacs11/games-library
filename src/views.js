const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const layout = (title, body) => `<!doctype html>
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
  .store { font-size: .8rem; border: 1px solid; border-radius: .5rem; padding: 0 .4rem; margin-right: .25rem; }
</style>
<h1>Games Library</h1>
<nav><a href="/">Library</a><a href="/connect">Connect</a></nav>
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
`;
};

const status = (row) =>
  !row
    ? `<p class="status">Not connected.</p>`
    : row.last_error
      ? `<p class="error">${esc(row.last_error)}</p>`
      : `<p class="status">${row.last_synced_at ? `Last synced ${esc(row.last_synced_at)}` : "Connected, never synced."}</p>`;
