// Era themes — one hand-tuned palette per decade, the single source of truth for
// decade-based theming (the user picks their decade in the quiz → profile.decade).
// Each is an art-tinted deep gradient + a vibrant accent (drives the top glow +
// aurora). Kept dark enough for white text, lifted/hued enough that every era
// reads as its own colour. No two decades share a look.
//
// Keys match profile.decade (lib/profile.js DECADES).

export const ERAS = {
  "50s":   { label: "50s", deep: "#241d14", deep2: "#322617", accentRgb: "200, 170, 130" }, // sepia jazz
  "60s":   { label: "60s", deep: "#2a2410", deep2: "#3a3014", accentRgb: "240, 180, 60" },  // psychedelic gold
  "70s":   { label: "70s", deep: "#2c1c0e", deep2: "#3e2810", accentRgb: "226, 120, 44" },  // burnt orange
  "80s":   { label: "80s", deep: "#1c0f2a", deep2: "#281542", accentRgb: "244, 72, 200" },  // synthwave magenta
  "90s":   { label: "90s", deep: "#102420", deep2: "#16322c", accentRgb: "70, 180, 150" },  // grunge teal
  "2000s": { label: "00s", deep: "#101a2e", deep2: "#152544", accentRgb: "74, 148, 244" },  // Y2K electric blue (default)
  "2010s": { label: "10s", deep: "#16142e", deep2: "#201c44", accentRgb: "130, 110, 250" }, // indigo-violet
  "2020s": { label: "20s", deep: "#1a1022", deep2: "#241533", accentRgb: "200, 80, 180" },  // plum
};

// Decade order for pickers / QA previews.
export const ERA_ORDER = ["50s", "60s", "70s", "80s", "90s", "2000s", "2010s", "2020s"];

// The resting default everyone gets before choosing their era theme.
export const DEFAULT_DECADE = "2000s";
export const DEFAULT_THEME = ERAS[DEFAULT_DECADE];

// Theme for a decade string, or null if unknown.
export function eraTheme(decade) {
  return ERAS[decade] || null;
}
