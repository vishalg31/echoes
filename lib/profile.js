// Profile model + helpers (spec 2.3).
// V0 storage is wired in the next step (cookie + base64 URL); this module
// defines the shape and a factory so the quiz and later screens agree on it.

export const DECADES = ["50s", "60s", "70s", "80s", "90s", "2000s", "2010s", "2020s"];

export function emptyProfile() {
  return {
    name: "",
    favourite_artist: "",
    top_songs: [],
    favourite_album: "",
    decade: "",
    overrated_artist: "",
    theme: "neutral-dark",
    known_songs: [],
    saved_songs: [],
    played_sessions: [],
  };
}

// Convert a release year (number) to a decade string matching the picker.
// 1973 -> "70s", 2015 -> "2010s". (spec 6.2 helper, used by decadeBias.)
export function getDecadeFromYear(year) {
  const n = Number(year);
  if (!n || Number.isNaN(n)) return "";
  const decade = Math.floor(n / 10) * 10;
  return decade < 2000 ? `${decade % 100}s` : `${decade}s`;
}
