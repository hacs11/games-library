# Games Library

A single-user local web app that gathers the games Andrew owns across several digital stores into one list, showing where each game was bought and whether it can be streamed on GeForce NOW.

## Language

**Game**:
A single work, independent of where it was bought — one row in the list. Games are inferred by matching Entitlements, never reported directly by a Store.
_Avoid_: Title, product, app

**Entitlement**:
The right to play one Game, granted by one Store, carrying that Store's own identifier and title string. A Game with three Entitlements was bought in three places.
_Avoid_: Copy, licence, purchase, ownership

**Store**:
A digital storefront that grants Entitlements: Steam, GOG, Epic, Xbox.
_Avoid_: Platform, launcher, vendor

**Play Anywhere**:
The only kind of Xbox Entitlement this library holds — a purchase carrying a PC build alongside the console one. Console-only and cloud-only Xbox titles are out of scope, because they can be neither installed on the Mac nor streamed through a PC store.
_Avoid_: Cross-buy, Xbox PC, Game Pass

**Sync**:
A user-triggered fetch of the current Entitlements from one Store, which updates the local record of what that Store says is owned.
_Avoid_: Import, refresh, scrape

**Connection**:
The stored credential — token, cookie, or API key — that lets a Sync read one Store on Andrew's behalf. Connections expire and are re-established by hand.
_Avoid_: Login, session, auth

**GeForce NOW**:
The cloud streaming service, reached in Australia through the alliance partner Pentanet. Support is published per Store, not per Game.
_Avoid_: GFN Alliance, Pentanet, cloud gaming

**Unmatched Entitlement**:
An Entitlement that IGDB could not identify, or that matched a Game with low confidence. It waits in a tray for Andrew to assign it, and once assigned it is locked against future matching.
_Avoid_: Orphan, unlinked game, conflict

**Market Low**:
The cheapest price gg.deals can see for a Game anywhere, together with its all-time low. It names no Store, so it sits beside the per-store prices and is never one of them (docs/adr/0006).
_Avoid_: Best price, lowest price, deal

**Keyshop**:
A reseller of game keys, priced by gg.deals separately from retail. A keyshop grants no Entitlement this library can read, so its price is shown labelled and on its own.
_Avoid_: Grey market, third-party store, reseller store
