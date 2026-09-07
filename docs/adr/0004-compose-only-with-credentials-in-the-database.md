# The app runs only under Docker Compose, and all credentials live in the database

A single-user tool on one Mac does not obviously need containerising, but OrbStack gives a Compose service a stable HTTPS domain (`web.games-library.orb.local`) with no port to remember, and making Compose the *only* way to run it removes the "works natively, breaks in the container" class of bug. Source is bind-mounted so hot reload still works; the SQLite file is a bind-mounted `./data` directory rather than a named volume, so it can be opened with a GUI, copied, and not destroyed by `docker compose down -v`.

Every credential — the Steam API key and SteamID, the IGDB client id and secret, and the refreshed GOG and Epic tokens — is stored in that SQLite file and entered through the Connect page. The app must write refreshed tokens somewhere anyway, so `.env` could only ever hold half of them; splitting them would put credentials in two places and require a restart to change a key.

## Consequences

`./data` must be gitignored, and it holds live OAuth tokens in plaintext — acceptable for a single-user app on a personal machine, and no worse than the token cache any store's own launcher keeps.

The image is `node:24-slim` using the standard library's `node:sqlite` instead of `better-sqlite3`, avoiding a native module and its build toolchain. `node:sqlite` is still flagged experimental and warns on startup.
