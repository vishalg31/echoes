// Recommendation layer (spec 6). V0 simplified scoring:
//   score = tagOverlap*0.6 - popularityPenalty*0.3 + decadeBias + knownPenalty
// Plus the 4-level fallback chain (6.4). Drift prevention (6.5) is V0-deferred.

import {
  getSimilarTracks,
  getTrackTopTags,
  getArtistTopTracks,
  getArtistSimilar,
  getTagTopTracks,
  itunesLookup,
  youtubeSearchUrl,
} from "./api";
import { getDecadeFromYear } from "./profile";

export function songId(artist, track) {
  return `${(artist || "").toLowerCase().trim()}::${(track || "").toLowerCase().trim()}`;
}

// Collapse "Song - 2007 Remaster", "Song (Live)", "Song - Single Version" etc.
// to a canonical key so variants of the same track dedupe together.
export function canonical(name) {
  let n = (name || "").toLowerCase();
  n = n.replace(/\([^)]*\)/g, " "); // drop parentheticals
  n = n.replace(/\s*-\s*.*\b(remaster|remastered|version|mix|live|mono|stereo|edit|demo|take|anniversary|deluxe)\b.*$/i, "");
  return n.replace(/\s+/g, " ").trim();
}

// ---- scoring pieces ----
function tagOverlap(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const shared = a.filter((t) => setB.has(t));
  const union = new Set([...a, ...b]);
  return shared.length / union.size; // Jaccard
}

function popularityPenalty(listeners) {
  // 0..1, higher for very popular tracks → surfaces deep cuts.
  if (!listeners || listeners <= 0) return 0;
  return Math.min(1, Math.log10(listeners + 1) / 8); // ~10^8 plays → 1
}

// Quality floor (not a popularity boost — we still favour deep cuts above this
// line). Drops candidates with a real-but-tiny count: typos, dead duplicates,
// misattributed tracks with no preview. The `> 0` guard is deliberate: a count
// of exactly 0 means "this code path didn't populate it" (e.g. tag search),
// NOT junk, so those pass through and the L3/L4 fallbacks stay intact.
const MIN_LISTENERS = 1000;
function belowFloor(listeners) {
  return listeners > 0 && listeners < MIN_LISTENERS;
}

function sharedTags(a = [], b = []) {
  const setB = new Set(b);
  return a.filter((t) => setB.has(t));
}

function reasonFor(shared, inputTrack) {
  if (shared.length) {
    const tag = shared.find((t) => t.length > 2) || shared[0];
    return `Shares a ${tag} feel with “${inputTrack}”.`;
  }
  return "A cross-artist pick from the same orbit.";
}

// ---- enrich a candidate with iTunes art + preview + year ----
async function enrich(c, inputTrackName, profile) {
  let extra = null;
  try {
    extra = await itunesLookup(c.artist, c.track);
  } catch {
    /* no art */
  }
  const year = extra?.year || "";
  const decadeBias =
    profile?.decade && year && getDecadeFromYear(year) === profile.decade ? 0.1 : 0;
  return {
    ...c,
    year,
    album: extra?.album || "",
    albumArt: extra?.artwork || null,
    previewUrl: extra?.preview || null,
    youtubeUrl: youtubeSearchUrl(c.artist, c.track),
    score: c.baseScore + decadeBias,
    why: reasonFor(c._shared || [], inputTrackName),
    id: songId(c.artist, c.track),
  };
}

// ---- TASTE MATCH (cross-artist, spec 4.2 + 6) ----
export async function recommendTasteMatch(input, profile, excludeIds = new Set()) {
  const log = [];
  const knownSet = new Set((profile?.known_songs || []).map((k) => (typeof k === "string" ? k : k.id)));
  const inputTags = await getTrackTopTags(input.artist, input.track).catch(() => []);

  // candidate pool from getSimilar
  let pool = await getSimilarTracks(input.artist, input.track, 40).catch(() => []);

  async function scorePool(candidates, minMatch) {
    // dedup + exclude self/known/played
    const seen = new Set();
    const filtered = candidates.filter((c) => {
      if (!c.track || !c.artist) return false;
      if (c.match != null && minMatch != null && c.match < minMatch) return false;
      if (belowFloor(c.listeners)) return false; // drop junk, keep unknown (0)
      const id = songId(c.artist, c.track);
      if (id === songId(input.artist, input.track)) return false;
      if (excludeIds.has(id) || knownSet.has(id)) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // fetch tags for the strongest ~14 (limits API calls)
    const top = filtered.slice(0, 14);
    const withTags = await Promise.all(
      top.map(async (c) => {
        const tags = await getTrackTopTags(c.artist, c.track).catch(() => []);
        const shared = sharedTags(tags, inputTags);
        const overlap = tagOverlap(tags, inputTags);
        const pen = popularityPenalty(c.listeners);
        const knownPenalty = knownSet.has(songId(c.artist, c.track)) ? -999 : 0;
        const baseScore = overlap * 0.6 - pen * 0.3 + knownPenalty;
        return { ...c, tags, _shared: shared, baseScore };
      })
    );
    return withTags.sort((x, y) => y.baseScore - x.baseScore);
  }

  // Level 1 — widen match threshold progressively
  let scored = [];
  for (let minMatch = 0.3; minMatch >= 0; minMatch -= 0.1) {
    scored = await scorePool(pool, minMatch);
    if (scored.length >= 3) break;
    log.push(`L1 widen minMatch=${minMatch.toFixed(1)} → ${scored.length}`);
  }

  // Level 2 — related artists' top tracks
  if (scored.length < 3) {
    log.push("L2 related-artists");
    const related = await getArtistSimilar(input.artist, 6).catch(() => []);
    const extra = [];
    for (const ra of related.slice(0, 5)) {
      const tracks = await getArtistTopTracks(ra, 8).catch(() => []);
      tracks.slice(0, 4).forEach((t) => extra.push({ ...t, match: 0.35 }));
    }
    scored = await scorePool([...pool, ...extra], 0);
  }

  // Level 3 — decade + tag genre search
  if (scored.length < 3 && inputTags.length) {
    log.push("L3 tag-search");
    const extra = [];
    for (const tag of inputTags.slice(0, 2)) {
      const tracks = await getTagTopTracks(tag, 20).catch(() => []);
      tracks.forEach((t) => extra.push(t));
    }
    scored = await scorePool(extra, 0);
  }

  // Level 4 — curated escape hatch (never a blank card)
  if (scored.length < 3) {
    log.push("L4 curated");
    const fill = curatedFor(inputTags).filter((c) => !excludeIds.has(songId(c.artist, c.track)));
    scored = scored.concat(
      fill.map((c) => ({ ...c, tags: inputTags, _shared: [], baseScore: 0.2 }))
    );
  }

  // Per-round diversity: at most one track per artist in the shown 3, so Taste
  // Match actually surfaces cross-artist picks (not 3 cuts from one band). This
  // is a light single-round cap, not the deferred session-wide drift system (6.5).
  const top3 = diversify(scored, 3);
  const enriched = await Promise.all(top3.map((c) => enrich(c, input.track, profile)));
  // re-sort after decadeBias applied during enrich
  enriched.sort((a, b) => b.score - a.score);
  return { candidates: enriched, fallbackLog: log };
}

// ---- ARTIST DEEP DIVE (spec 4.1) ----
// Stays entirely within the chosen artist. Pulls their whole known catalogue,
// drops the obvious hits, and serves deep cuts round after round. When the
// catalogue is genuinely exhausted it returns 0 candidates (the UI shows an
// "explored everything" end state) — it never wanders to other artists.
export async function recommendDeepDive(artist, profile, excludeIds = new Set()) {
  const knownSet = new Set((profile?.known_songs || []).map((k) => (typeof k === "string" ? k : k.id)));
  const log = [];
  const tracks = await getArtistCatalogue(artist);

  if (!tracks.length) {
    log.push("deepdive empty → curated");
    const fill = curatedFor([]).slice(0, 3);
    const enriched = await Promise.all(
      fill.map((c) => enrich({ ...c, baseScore: 0.2, _shared: [] }, artist, profile))
    );
    return { candidates: enriched, fallbackLog: log };
  }

  // collapse remaster/live/version duplicates to one canonical entry (keeps the
  // highest-ranked), so a hit can't sneak back in as "X - Remaster".
  const seenCanon = new Set();
  const deduped = [];
  for (const t of tracks) {
    const c = canonical(t.track);
    if (!c || seenCanon.has(c)) continue;
    seenCanon.add(c);
    deduped.push(t);
  }

  // drop the top ~20% most popular (avoid obvious hits)
  const cut = Math.max(1, Math.floor(deduped.length * 0.2));
  const deep = deduped.slice(cut);

  const picks = [];
  for (const t of deep) {
    const id = songId(t.artist || artist, t.track);
    if (excludeIds.has(id) || knownSet.has(id)) continue;
    picks.push({
      track: t.track,
      artist: t.artist || artist,
      listeners: t.listeners,
      baseScore: 0.5,
      _shared: [],
    });
    if (picks.length >= 3) break;
  }

  const enriched = await Promise.all(
    picks.map(async (c) => {
      const e = await enrich(c, c.track, profile);
      return { ...e, why: `A deeper cut from ${artist}.` };
    })
  );
  return { candidates: enriched, fallbackLog: log };
}

// Fetch as much of an artist's catalogue as Last.fm exposes (paginated).
const catalogueCache = new Map();
async function getArtistCatalogue(artist) {
  const key = artist.toLowerCase().trim();
  if (catalogueCache.has(key)) return catalogueCache.get(key);
  // page 1 gives top tracks; deeper pages reach the long tail of the catalogue.
  const pages = await Promise.all([
    getArtistTopTracks(artist, 200, 1).catch(() => []),
    getArtistTopTracks(artist, 200, 2).catch(() => []),
    getArtistTopTracks(artist, 200, 3).catch(() => []),
  ]);
  const all = [];
  const seen = new Set();
  for (const page of pages) {
    for (const t of page) {
      const id = songId(t.artist || artist, t.track);
      if (seen.has(id)) continue;
      seen.add(id);
      all.push(t);
    }
  }
  catalogueCache.set(key, all);
  return all;
}

// Limit to one track per artist, filling to `limit` from the rest if needed.
function diversify(scored, limit) {
  const out = [];
  const artists = new Set();
  for (const c of scored) {
    const a = (c.artist || "").toLowerCase();
    if (artists.has(a)) continue;
    out.push(c);
    artists.add(a);
    if (out.length >= limit) break;
  }
  if (out.length < limit) {
    for (const c of scored) {
      if (out.includes(c)) continue;
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ---- curated escape hatch by genre (spec 6.4 Level 4) ----
function curatedFor(tags = []) {
  const t = tags.join(" ");
  if (/psych|prog|space/.test(t))
    return [
      { track: "Astronomy Domine", artist: "Pink Floyd" },
      { track: "I Talk to the Wind", artist: "King Crimson" },
      { track: "Careful with That Axe, Eugene", artist: "Pink Floyd" },
    ];
  if (/grunge|alt|punk/.test(t))
    return [
      { track: "About a Girl", artist: "Nirvana" },
      { track: "Black", artist: "Pearl Jam" },
      { track: "Today", artist: "The Smashing Pumpkins" },
    ];
  if (/hip ?hop|rap/.test(t))
    return [
      { track: "They Reminisce Over You", artist: "Pete Rock & CL Smooth" },
      { track: "Electric Relaxation", artist: "A Tribe Called Quest" },
      { track: "Liquid Swords", artist: "GZA" },
    ];
  if (/electronic|house|techno|dance/.test(t))
    return [
      { track: "Da Funk", artist: "Daft Punk" },
      { track: "Windowlicker", artist: "Aphex Twin" },
      { track: "Born Slippy", artist: "Underworld" },
    ];
  // default classic-rock-ish safe picks
  return [
    { track: "Comfortably Numb", artist: "Pink Floyd" },
    { track: "Gimme Shelter", artist: "The Rolling Stones" },
    { track: "Go Your Own Way", artist: "Fleetwood Mac" },
  ];
}
