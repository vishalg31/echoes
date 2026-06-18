// Theming system (spec 3.5 + resolution algorithm 3.5).
// V0 = preset buckets. Two users with different artist/decade get different
// colours, fonts, textures. Default is light (neutral-light); era themes keep
// their identity, several dark by design (Decision 3 in BUILD_LOG).
//
// All themes write the SAME CSS variable names (spec 3.6) so components never
// know which theme is active. applyTheme() sets them inline on <html>.

import { getArtistTopTags } from "./api";

// Art-led dark identity (2026-06-18): the shell is now CONSTANT. Every theme
// shares the same near-black surfaces and the same fonts (Bricolage display +
// Inter body). A "theme" only carries a fallback accent + a label + a texture,
// used before/without album-art mood. The album art is the real personality.
const DISPLAY = "var(--font-bricolage), 'Segoe UI', system-ui, sans-serif";

// ---- textures (pure CSS, no image assets) ----
const TEX = {
  none: { bg: "none", opacity: 0 },
  noise: {
    bg: "radial-gradient(rgba(120,100,70,0.25) 0.5px, transparent 0.5px)",
    size: "3px 3px",
    opacity: 0.06,
  },
  swirl: {
    bg: "radial-gradient(120% 80% at 20% 10%, rgba(255,180,80,0.18), transparent 60%), radial-gradient(120% 80% at 80% 90%, rgba(255,120,40,0.16), transparent 60%)",
    size: "auto",
    opacity: 0.6,
  },
  vinyl: {
    bg: "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 4px)",
    size: "auto",
    opacity: 0.5,
  },
  spaceDust: {
    bg: "radial-gradient(rgba(160,180,255,0.5) 0.6px, transparent 0.6px), radial-gradient(rgba(190,150,255,0.35) 0.5px, transparent 0.5px)",
    size: "40px 40px, 25px 25px",
    opacity: 0.4,
  },
  scanlines: {
    bg: "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)",
    size: "auto",
    opacity: 0.7,
  },
  chrome: {
    bg: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.10) 45%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.10) 55%, transparent 70%)",
    size: "auto",
    opacity: 0.6,
  },
  halftone: {
    bg: "radial-gradient(rgba(0,0,0,0.18) 1.2px, transparent 1.2px)",
    size: "10px 10px",
    opacity: 0.12,
  },
  distressed: {
    bg: "radial-gradient(rgba(60,60,40,0.3) 0.6px, transparent 0.7px), repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 5px)",
    size: "4px 4px, auto",
    opacity: 0.1,
  },
  film: {
    bg: "radial-gradient(rgba(0,0,0,0.2) 0.5px, transparent 0.6px)",
    size: "2.5px 2.5px",
    opacity: 0.08,
  },
};

// ---- the constant plum shell ----
// One identity now: every theme shares the plum-tinted dark surfaces, plum
// accent, and the constant fonts. A "theme" only carries a label + texture for
// flavour; per-song colour comes from the album-art mood layer.
function shell(over = {}) {
  return {
    "bg-primary": "#0a0810",
    "bg-secondary": "#16121e",
    "card-bg": "#181320",
    "card-bg-alt": "#221a2e",
    "elevated": "#201a2b",
    "text-primary": "#f5f2f8",
    "text-muted": "#aba2b6",
    "text-faint": "#6e6678",
    "accent-primary": "#c84ba0",
    "accent-soft": "color-mix(in srgb, var(--accent-primary) 16%, transparent)",
    "accent-text": "#e25aa6",
    "border": "rgba(225,180,255,0.09)",
    "border-card": "rgba(225,180,255,0.07)",
    "progress-track": "rgba(225,180,255,0.14)",
    "font-display": DISPLAY,
    "anim-speed": "600ms",
    ...over,
  };
}

// ---- the buckets ----
// All share the plum shell; only the label + texture vary per artist/genre.
function bucket(label, texture) {
  return { label, dark: true, texture, tokens: shell({}) };
}

export const THEMES = {
  "neutral-dark": bucket("Echoes", "noise"),
  "neutral-light": bucket("Echoes", "noise"),
  "psychedelic-warm": bucket("Psychedelic", "swirl"),
  "heavy-earth": bucket("Heavy Earth", "vinyl"),
  "cosmic-dark": bucket("Cosmic", "spaceDust"),
  "glam-shock": bucket("Glam", "chrome"),
  "neon-contrast": bucket("Neon", "scanlines"),
  "grunge-muted": bucket("Grunge", "vinyl"),
  "paranoid-grey": bucket("Paranoid", "scanlines"),
  "chrome-future": bucket("Chrome", "chrome"),
  "street-bold": bucket("Street", "vinyl"),
  "pastel-editorial": bucket("Pastel", "noise"),
};

// exact artist -> bucket (case-insensitive)
const ARTIST_BUCKET = {
  "the beatles": "psychedelic-warm",
  beatles: "psychedelic-warm",
  "led zeppelin": "heavy-earth",
  "pink floyd": "cosmic-dark",
  "david bowie": "glam-shock",
  "michael jackson": "neon-contrast",
  nirvana: "grunge-muted",
  radiohead: "paranoid-grey",
  "daft punk": "chrome-future",
  "taylor swift": "pastel-editorial",
};

// decade -> colour ramp (resolution step 2, no image processing)
const DECADE_RAMP = {
  "50s": { bucket: "psychedelic-warm" },
  "60s": { bucket: "psychedelic-warm" },
  "70s": { bucket: "heavy-earth" },
  "80s": { bucket: "neon-contrast" },
  "90s": { bucket: "grunge-muted" },
  "2000s": { bucket: "chrome-future" },
  "2010s": { bucket: "pastel-editorial" },
  "2020s": { bucket: "pastel-editorial" },
};

// genre tag -> bucket (resolution step 2 — texture/font/feel by genre)
const GENRE_BUCKET = [
  [/psych|prog|space rock|art rock/, "cosmic-dark"],
  [/grunge|alt|alternative|punk/, "grunge-muted"],
  [/metal|hard rock/, "heavy-earth"],
  [/classic rock|blues rock|rock and roll|southern rock/, "heavy-earth"],
  [/synth|new wave|80s|electro pop/, "neon-contrast"],
  [/electronic|house|techno|edm|dance/, "chrome-future"],
  [/hip ?hop|rap|trap/, "street-bold"],
  [/folk|singer-songwriter|indie folk|acoustic/, "pastel-editorial"],
  [/pop/, "pastel-editorial"],
  [/experimental|electronica|trip ?hop/, "paranoid-grey"],
];

function bucketFromGenre(tags) {
  for (const t of tags) {
    for (const [re, bucket] of GENRE_BUCKET) {
      if (re.test(t)) return bucket;
    }
  }
  return null;
}

// Build a final theme object { name, label, dark, texture, tokens }
function pack(name) {
  const t = THEMES[name] || THEMES["neutral-light"];
  return { name, label: t.label, dark: t.dark, texture: t.texture, tokens: t.tokens };
}

// Synchronous resolve: exact artist match, else null (needs async for genre step).
export function resolveThemeSync(profile) {
  const artist = (profile?.favourite_artist || "").trim().toLowerCase();
  if (artist && ARTIST_BUCKET[artist]) return pack(ARTIST_BUCKET[artist]);
  return null;
}

// Full resolution (spec 3.5): exact -> genre+decade -> default.
export async function resolveTheme(profile) {
  const exact = resolveThemeSync(profile);
  if (exact) return exact;

  const artist = (profile?.favourite_artist || "").trim();
  const decade = profile?.decade || "";

  // step 2 — genre tag from Last.fm, blended with decade ramp
  if (artist) {
    try {
      const tags = await getArtistTopTags(artist);
      const byGenre = bucketFromGenre(tags);
      if (byGenre) return pack(byGenre);
    } catch {
      /* fall through */
    }
  }
  if (decade && DECADE_RAMP[decade]) return pack(DECADE_RAMP[decade].bucket);

  // step 3 — default
  return pack("neutral-light");
}

// Apply a theme's tokens to <html> inline, plus texture variables.
export function applyTheme(theme) {
  if (typeof document === "undefined" || !theme) return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.name);
  root.dataset.dark = theme.dark ? "true" : "false";
  for (const [k, v] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${k}`, v);
  }
  const tex = TEX[theme.texture] || TEX.none;
  root.style.setProperty("--texture-bg", tex.bg);
  root.style.setProperty("--texture-size", tex.size || "auto");
  root.style.setProperty("--texture-opacity", String(tex.opacity ?? 0));
}

// 5 swatches for the profile card colour strip.
export function themeSwatches(theme) {
  const t = theme.tokens;
  return [
    t["bg-primary"],
    t["bg-secondary"],
    t["accent-primary"],
    t["accent-text"],
    t["text-primary"],
  ];
}
