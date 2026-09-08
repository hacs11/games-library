import { test } from "node:test";
import assert from "node:assert/strict";

// The route table opens a database on import; give it one that is not the file
// the container is holding open.
process.env.LIBRARY_DB = ":memory:";
const { handle } = await import("./server.js");

// A response that records what a handler did to it, instead of a socket.
const spy = () => {
  const res = {
    status: 0,
    headers: {},
    body: "",
    headersSent: false,
    writeHead(status, headers = {}) {
      res.status = status;
      Object.assign(res.headers, headers);
      res.headersSent = true;
      return res;
    },
    setHeader(k, v) {
      res.headers[k] = v;
    },
    end(body = "") {
      res.body = body;
      return res;
    },
  };
  return res;
};

const request = (method, url, headers = {}) => {
  const req = { method, url, headers };
  // Handlers that read a body iterate the request; none of these send one.
  req[Symbol.asyncIterator] = async function* () {};
  return req;
};

// docs/adr/0002: hand-typed Xbox Entitlements cannot be re-synced, so a
// cross-site POST that reaches /xbox/remove is unrecoverable data loss.
test("a POST from another site is refused before it reaches any handler", async () => {
  for (const headers of [
    { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
    { origin: "https://evil.example", host: "localhost:3000" },
  ]) {
    const res = spy();
    await handle(request("POST", "/xbox/remove", headers), res);
    assert.equal(res.status, 403, JSON.stringify(headers));
  }
});

test("a POST from this app, or from a client that sends no fetch metadata, is let through", async () => {
  for (const headers of [
    { "sec-fetch-site": "same-origin" },
    { host: "localhost:3000" },
    {},
  ]) {
    const res = spy();
    await handle(request("POST", "/nothing-here", headers), res);
    // Past the guard, so it fails on routing rather than on origin.
    assert.equal(res.status, 404, JSON.stringify(headers));
  }
});

test("the guard only stands in front of writes", async () => {
  const res = spy();
  await handle(request("GET", "/jobs", { "sec-fetch-site": "cross-site" }), res);
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), {});
});
