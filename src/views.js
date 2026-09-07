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
  .store { font-size: .8rem; border: 1px solid; border-radius: .5rem; padding: 0 .4rem; margin-right: .25rem; }
</style>
<h1>Games Library</h1>
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
