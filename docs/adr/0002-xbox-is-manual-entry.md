# Xbox Entitlements are entered by hand

Steam, GOG and Epic all expose a reachable "what do I own" endpoint; Xbox does not. The only practical alternative is a third-party gateway that returns *title history* — games played, not games owned — which conflates Game Pass with purchases and depends on someone else's free tier staying up. Xbox Entitlements are therefore bulk-pasted as a list of titles, auto-matched best-effort, with the misses landing in the same unmatched tray as every other Store.

Only **Xbox Play Anywhere** titles are entered — the ones with a PC build tied to the same purchase. Console-only and cloud-only titles are deliberately excluded: this library answers "what can I play on this machine, and where", and a console-exclusive is neither installable on the Mac nor streamable through a PC store on GeForce NOW. It would be a row that is never a true answer to the question being asked.

Titles are pasted one per line, and the normalised title is the Entitlement's id, so re-pasting a whole library adds only what is new. Matching runs on paste — IGDB by title, since there is no store id — which is what lets an Xbox title merge onto the Game its Steam, GOG and Epic copies already share. GeForce NOW support still resolves, because Pentanet's catalogue carries 444 Xbox variants.

## Consequences

Xbox data goes stale silently, because nothing re-checks it. The `Sync` concept does not apply to Xbox at all — its Entitlements only change when Andrew edits them.

Xbox Entitlements are the only ones the app can delete: every other Store can correct a mistake on the next Sync, and a typo typed by hand would otherwise be permanent.

These rows are also the first data in the database that cannot be re-created, which is what forced real migrations (tracked in SQLite's `user_version`) in place of "delete `data/library.db` and sync again".
