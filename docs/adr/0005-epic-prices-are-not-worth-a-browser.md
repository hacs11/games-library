# Epic prices are not worth putting a browser in the container

Every other catalogue answers a plain `fetch`. Epic does not, and the difference is Cloudflare rather than anything about the data. Retested against the live service:

| What was tried | Result |
|---|---|
| `store.epicgames.com/browse?...&priceTier=tierDiscouted` with a browser User-Agent | **403**, Cloudflare interstitial |
| `POST store.epicgames.com/graphql`, the query that page runs | **403**, same interstitial |
| `graphql.epicgames.com/graphql` | 404 `Gone` |
| `store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions` | **200** — real `discount`, `discountPrice`, `originalPrice`, AUD `fmtPrice`, but only the ~11 current and upcoming free-game promotions |
| The authenticated catalog service (already used for owned games) | 200, list price only, **no discount field anywhere** |
| The same browse URL in a real, signed-in Chrome | 200, and the whole answer is already in the HTML: `window.__REACT_QUERY_INITIAL_QUERIES__` holds all 40 offers with prices, discounts, slugs and release dates |

So the data is not hidden behind client-side rendering or a private API — one GET returns it. Only the bot check stands in the way, and passing it is what a browser is for.

## What a browser would cost

A headless Chromium in the image contradicts two decisions at once. It needs either Playwright or Puppeteer — and there are **no npm dependencies at all** in this project, by choice — or a hand-written DevTools Protocol client, which Node 24 can actually manage with its global `WebSocket` and `fetch`. Either way the *binary* is the real cost: `node:24-slim` is around 200 MB, and Chromium with its font and library dependencies adds roughly 400 MB more.

That is the cheap part. Headless Chrome is itself detectable, so a bot check is not a problem you solve once — it is a dependency on someone else's detection heuristics, checked by a scheduled job that will fail silently and stale-price the catalogue rather than erroring loudly.

The escape hatch that keeps both constraints is **not** a browser in the container: Chrome on the host, started with `--remote-debugging-port=9222`, is reachable from the container at `host.docker.internal:9222` and drivable over the DevTools Protocol with nothing but the standard library. It is a real browser with a real profile, so it passes the check for the same reason the manual attempt did. It is written down here because it is the thing to reach for if this is ever revisited — not because it is free: the debug port is unauthenticated, and anything that can open it can drive a signed-in browser, so it would have to be started deliberately for a refresh and not left running.

## What it would buy

GeForce NOW's Australian catalogue holds 2,484 distinct titles. It lists 549 of them under Epic — and **494 of those 549 are also sold on Steam, GOG or Xbox**, all three of which price cleanly today. Epic prices would therefore add a price to **55 titles, 2.2% of the catalogue**.

Per docs/adr/0003 a price is only shown for a Store that GeForce NOW lists the title under, so for those 494 the Steam or GOG price already shown *is* the right one — it is the price of a copy that will actually stream. Epic's price would be a fourth number next to three correct ones.

## Decision

Epic stays unpriced. Its Entitlements are still synced and still badged; its titles show "No price" and the Discover panel says why. Adding half a gigabyte, a bot-detection arms race, and the first npm dependency in the project to fill in 2.2% of a catalogue is the wrong trade, and it stays the wrong trade until Epic publishes a discount field on the authenticated service — which is the condition to revisit this.

## Consequences

An Epic-only sale is invisible to Discover. Fifty-five titles show no price at all, including their discounts, and the watchlist cannot flag them when they drop.

The manual route remains available and needs no code: the browse page's `__REACT_QUERY_INITIAL_QUERIES__` blob is a complete, parseable answer for anyone who wants to read it out of their own browser. A paste-based Connection in the shape Epic's login already uses (docs/adr/0004) is the smallest thing that could turn that into stored prices, and remains the first thing to try if the 55 ever start to matter.

The 403s are recorded above so the next person does not spend an afternoon rediscovering them.
