const OWNED = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";

// Steam returns an empty `response` object — not an error — when the account's
// game details are private. Treat that as a connection problem, not zero games.
export async function fetchOwnedGames({ api_key, steam_id }) {
  const url = `${OWNED}?key=${encodeURIComponent(api_key)}&steamid=${encodeURIComponent(steam_id)}&include_appinfo=1&include_played_free_games=1&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam returned ${res.status} ${res.statusText}`);

  const { response } = await res.json();
  if (!response?.games) {
    throw new Error(
      "Steam returned no game list. Set your profile's Game Details to Public, or check the SteamID.",
    );
  }
  return response.games.map((g) => ({
    store_game_id: String(g.appid),
    store_title: g.name,
  }));
}
