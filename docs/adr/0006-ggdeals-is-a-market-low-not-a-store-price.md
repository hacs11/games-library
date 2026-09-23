# GG.deals is a Market Low, not a Store price

`gg.deals` aggregates prices for ~300,000 titles across 60+ stores and keyshops, refreshed hourly, and it has a real API rather than a page to scrape. Retested against the live service:

| What was tried | Result |
|---|---|
| `gg.deals/api/`, `gg.deals/api/prices/` — the documentation | **403**, Cloudflare interstitial, browser User-Agent and all |
| `gg.deals/api/v1/prices/by-steam-app-id/` | **403**, same interstitial — the docs' own path is behind the bot check |
| `api.gg.deals/v1/prices/by-steam-app-id/?ids=570&key=test` | **400** `{"success":false,"data":{"message":"Invalid key."}}` — plain JSON, no interstitial, from `curl` |

So unlike Epic (docs/adr/0005) the API host itself is reachable with nothing but `fetch`. The request is a comma-separated list of **Steam appids, 100 per request** — the same batch size the Steam resolver already uses — plus `key` and an optional `region` (`au` is supported). Each title comes back as `title`, `url`, `currentRetail`, `currentKeyshops`, `historicalRetail`, `historicalKeyshops`, `currency`.

## Why it cannot be a Store price

The free tier returns **the cheapest retail price and the cheapest keyshop price, with no indication of which store either came from**. Store-granular pricing and the top-ten listings are Premium only.

That is exactly the shape docs/adr/0003 forbids. A price in this app is only shown for a Store that GeForce NOW lists the title under, because otherwise a cheap copy badges a title that the cheap copy cannot stream — and `currentRetail` is a price from an unnamed store, which can never satisfy `sells()`. It cannot enter `catalogue_price`, which is keyed by `(store, store_id)` for that reason, and it cannot feed `best_price` or `best_discount`.

Nor does it rescue Epic. `currentRetail` for an Epic-listed title is "cheapest official store", which is usually Steam — the number docs/adr/0005 already calls a fourth figure next to three correct ones. Epic stays unpriced and that ADR stands unchanged.

## What it would buy

Against the current Australian catalogue, 2,487 distinct titles:

| | Titles |
|---|---|
| Priced today from Steam, GOG or Xbox | 1,964 |
| **No price at all** | **523** |
| …of those, with a resolvable Steam appid, so addressable by this API | **377** |
| …of those 377, addressable *only* via the appid GeForce NOW's NVIDIA list carries | 159 |
| …with no Steam appid from either source, so unreachable | 146 |

The 523 are mostly titles GeForce NOW lists under a store this app cannot price — Epic, Ubisoft Connect, Battle.net, EA — or titles whose normalised title is claimed by more than one Steam product and was therefore dropped rather than guessed. A Market Low reaches 377 of them without touching the rule that dropped them, because it asks by appid and never has to pick a store.

It is also new information for the 1,964 that *are* priced: `historicalRetail` is an all-time low going back to 2014, which is the number that answers "is this actually a good sale" and which no store's own API will ever report.

One refresh of the whole catalogue is **24 requests** — 2,334 appids at 100 per request — against an hourly-refreshed source, so it is by far the cheapest sweep in the app.

## Decision

Adopt gg.deals as a **Market Low**: a cheapest-anywhere figure and its all-time low, keyed by Steam appid, stored in its own table and displayed in its own row, beside the per-store prices and never mixed into them. The keyshop figure is kept and shown separately from the retail one, labelled as a keyshop, because a grey-market key is a different thing from a Store that grants an Entitlement.

The key is a `ggdeals` row in `store_credential`, entered on the Connect page — the precedent is `igdb`, which is already stored that way without being a Store (docs/adr/0004).

## Consequences

Every page showing this data must carry an active hyperlink to gg.deals; their free tier requires attribution, and the `url` field in each response is the link to use. Free access is personal and hobby use only, which is what this app is; a Premium key is the condition for revisiting the store-granular version, and only that would let these prices become Store prices under docs/adr/0003.

The Market Low is not gated by `sells()` and must therefore never be badged as a discount on a store row or counted in `best_discount` — the same mistake the `sells()` clause exists to prevent, one column over. It is a reference figure with a link, in the way the Metacritic score is.

146 catalogue titles have no Steam appid from either source and gain nothing. Titles sold only outside Steam but carrying a Steam appid will return a Market Low for the Steam product, which is the right title but may be a different edition.

Reaching `api.gg.deals` and not `gg.deals` is load-bearing: the documented path 403s, so the working host is recorded here to save the next person the afternoon.
