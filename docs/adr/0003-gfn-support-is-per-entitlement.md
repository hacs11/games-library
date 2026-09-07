# GeForce NOW support is a property of an Entitlement, not a Game

NVIDIA's public catalogue (`static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-AU.json`, 1,496 entries) lists each supported game *per store*: Cyberpunk 2077 appears under GOG, and owning it on Epic tells you nothing. Support is therefore stored against the Entitlement, with a derived Game-level flag for filtering and a per-store badge for deciding which launcher to point GFN at.

The AU locale file is used rather than the global one because the alliance partner catalogue genuinely differs in size and contents from `en-US`.

## Consequences

Only 5 of the 1,496 AU entries are GOG, and 1,100 are Steam. A large GOG library will come back almost entirely unsupported — that is an accurate answer, not a matching failure. Steam Entitlements match exactly via the appid embedded in each entry's `steamUrl`; every other Store falls back to title matching.
