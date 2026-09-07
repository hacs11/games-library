# GeForce NOW support is a property of an Entitlement, not a Game

Support is published per store: *Fallout 3 Game of the Year Edition* streams from Epic, Steam and Xbox but not GOG, so owning it on GOG tells you nothing about owning it on Epic. Support is therefore stored against the Entitlement, with a derived Game-level flag for filtering and a per-store badge for deciding which launcher to point GeForce NOW at.

## The catalogue comes from Pentanet, not NVIDIA

`cloud.gg/api/games/list/{page}/{size}` is the Australian alliance partner's own catalogue: 2,203 games, 3,242 store variants, unauthenticated, 100 per page, **zero-indexed** — starting at page 1 silently drops the first 100 games, which is how Half-Life 2 went missing until the site's own request was observed in the browser. Each game carries `variants[]` with an `appStore` (`STEAM`, `EPIC`, `GOG`, `XBOX`, …), which is what makes per-Entitlement support expressible.

This replaced NVIDIA's static `supported-public-game-list` file, which was used first and is **not a complete catalogue**. It appears to list only publishers who consented to public listing: it contains zero Fallout, Starfield, Forza, Halo, Gears, Elder Scrolls, Doom or Baldur's Gate entries, all of which stream. Against a real library it found 70 streamable games where Pentanet's finds 149. It was caught only because a game the user knew he could stream showed no badge.

NVIDIA's file is still fetched for exactly one thing: its Steam entries carry the appid from `steamUrl`, and an appid is exact where a title is not — worth extra Steam matches (30 → 48), including Portal 2 and Team Fortress 2, whose store titles do not match their catalogue titles. It only ever adds matches, so failing to fetch it is logged and ignored rather than failing the Sync.

## Consequences

Pentanet's variant ids are NVIDIA's own, not store ids, so every Store except Steam matches on normalised title alone. A missing badge means "not found in the catalogue", which is weaker than "will not stream" — the UI says so rather than asserting a negative.

Only 12 of the 3,242 variants are GOG, so a large GOG library comes back almost entirely unsupported. That is an accurate answer, not a matching failure.

The catalogue is replaced wholesale on each Sync, but only once the full paginated fetch has succeeded: a partial response must never silently erase existing badges.
