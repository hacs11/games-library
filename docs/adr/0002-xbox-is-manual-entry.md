# Xbox Entitlements are entered by hand

Steam, GOG and Epic all expose a reachable "what do I own" endpoint; Xbox does not. The only practical alternative is a third-party gateway that returns *title history* — games played, not games owned — which conflates Game Pass with purchases and depends on someone else's free tier staying up. Xbox Entitlements are therefore bulk-pasted as a list of titles, auto-matched best-effort, with the misses landing in the same unmatched tray as every other Store.

## Consequences

Xbox data goes stale silently, because nothing re-checks it. The `Sync` concept does not apply to Xbox at all — its Entitlements only change when Andrew edits them.
