# Games are inferred from Entitlements, never reported by a Store

No Store can tell us that its copy of a game is the same work as another Store's copy, so the app derives each Game by matching Entitlements against IGDB's `external_games` mappings (Steam appid, GOG id, Epic id), falling back to normalised-title clustering when IGDB has no mapping. Low-confidence matches surface in an unmatched tray rather than merging silently, and a manual correction is locked so later Syncs cannot undo it.

## Considered Options

SteamGridDB was rejected as the identity spine — it maps store ids but is primarily an artwork service with thinner coverage. Pure title matching was rejected because it silently collapses distinct works with similar names (*Deus Ex* 2000 vs *Deus Ex: Mankind Divided*), and a silent bad merge is invisible until you go looking for a game that vanished.

## Consequences

IGDB requires a Twitch developer application (client id + secret) and a token refresh inside the Sync path — a third-party dependency on the critical path of every Sync.
