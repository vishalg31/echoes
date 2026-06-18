// Taste fingerprint (spec 14.2): pure aggregations over discovered songs and
// sessions. Every number maps to real data the app already captured at discovery
// time. Tolerant of legacy known-song entries that predate the enriched record
// (no tags / year / listeners) — those are simply skipped per stat.

import { getDecadeFromYear } from "./profile";

const DECADE_ORDER = ["50s", "60s", "70s", "80s", "90s", "2000s", "2010s", "2020s"];

// keep only real object entries (ignore legacy bare-string ids)
function objects(knownSongs = []) {
  return knownSongs.filter((k) => k && typeof k === "object" && k.track);
}

// top tags across discoveries → [{ tag, count }]
export function genreMap(knownSongs, limit = 6) {
  const counts = new Map();
  for (const k of objects(knownSongs)) {
    for (const raw of k.tags || []) {
      const tag = String(raw).toLowerCase().trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// discoveries bucketed by decade → [{ decade, count }] in chronological order
export function eraSpread(knownSongs) {
  const counts = new Map();
  for (const k of objects(knownSongs)) {
    const d = getDecadeFromYear(k.year);
    if (!d) continue;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  return DECADE_ORDER.filter((d) => counts.has(d)).map((d) => ({ decade: d, count: counts.get(d) }));
}

// the discovered song with the fewest listeners
export function rarestFind(knownSongs) {
  let best = null;
  for (const k of objects(knownSongs)) {
    const l = Number(k.listeners);
    if (!l || Number.isNaN(l)) continue;
    if (!best || l < best._l) best = { ...k, _l: l };
  }
  return best;
}

export function totals(knownSongs, sessions = []) {
  const known = objects(knownSongs);
  const artists = new Set(known.map((k) => (k.artist || "").toLowerCase()).filter(Boolean));
  let longestChain = 0;
  for (const s of sessions) longestChain = Math.max(longestChain, (s.chain || []).length);
  return { songs: known.length, artists: artists.size, sessions: sessions.length, longestChain };
}

// device-scoped milestones, surfaced as quiet badges (spec 14.4). Thresholds
// are tuned so a first session earns one or two early, with a few that take
// real exploring to unlock — a ladder, not an all-or-nothing wall.
export function badges(knownSongs, sessions = []) {
  const out = [];
  const t = totals(knownSongs, sessions);

  // volume ladder
  if (t.songs >= 5) out.push({ key: "collector", label: "Collector", hint: `${t.songs} found` });
  if (t.songs >= 25) out.push({ key: "deep-diver", label: "Deep Diver", hint: `${t.songs} found` });

  // breadth across artists and eras
  if (t.artists >= 8) out.push({ key: "explorer", label: "Explorer", hint: `${t.artists} artists` });
  const eras = eraSpread(knownSongs);
  if (eras.length >= 4) {
    out.push({ key: "time-traveller", label: "Time Traveller", hint: `${eras.length} decades` });
  }

  // genre spread
  const genres = genreMap(knownSongs, 99);
  if (genres.length >= 5) {
    out.push({ key: "genre-hopper", label: "Genre Hopper", hint: `${genres.length} genres` });
  }

  // chain length
  if (t.longestChain >= 7) {
    out.push({ key: "chain-builder", label: "Chain Builder", hint: `${t.longestChain}-song chain` });
  }

  // rarity
  const rare = rarestFind(knownSongs);
  if (rare && rare._l < 50000) {
    out.push({ key: "crate-digger", label: "Crate Digger", hint: `${fmtCount(rare._l)} listeners` });
  }

  return out;
}

// 1234 → "1.2k", 1200000 → "1.2M"
export function fmtCount(n) {
  const x = Number(n);
  if (!x || Number.isNaN(x)) return "0";
  if (x >= 1e6) return `${(x / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (x >= 1e3) return `${(x / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  return String(x);
}
