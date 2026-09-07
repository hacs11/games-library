import { createServer } from "node:http";
import { open, listGames } from "./db.js";
import { layout, listPage } from "./views.js";

const db = open();

const routes = {
  "GET /": () => layout("Library", listPage(listGames(db))),
};

createServer((req, res) => {
  const handler = routes[`${req.method} ${new URL(req.url, "http://x").pathname}`];
  if (!handler) return res.writeHead(404).end("Not found");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(handler());
}).listen(3000, () => console.log("http://localhost:3000"));
