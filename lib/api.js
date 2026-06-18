// Client-side API helpers. All network calls go through our route handlers
// (/api/lastfm, /api/itunes, /api/wiki) so the Last.fm key stays server-side
// and iTunes CORS is avoided. Results are memoised per session.

const mem = new Map();
async function memo(key, fn) {
  if (mem.has(key)) return mem.get(key);
  const p = fn().catch((e) => {
    mem.delete(key); // don't cache failures
    throw e;
  });
  mem.set(key, p);
  return p;
}

// ---------- Last.fm ----------
async function lastfm(method, params = {}) {
  const qs = new URLSearchParams({ method, ...params });
  const r = await fetch(`/api/lastfm?${qs.toString()}`);
  return r.json();
}

export function getSimilarTracks(artist, track, limit = 30) {
  return memo(`sim:${artist}:${track}`, async () => {
    const d = await lastfm("track.getSimilar", { artist, track, limit: String(limit), autocorrect: "1" });
    const arr = d?.similartracks?.track || [];
    return arr.map((t) => ({
      track: t.name,
      artist: t.artist?.name || "",
      match: Number(t.match) || 0,
      listeners: Number(t.playcount) || 0,
    }));
  });
}

export function getTrackTopTags(artist, track) {
  return memo(`ttags:${artist}:${track}`, async () => {
    const d = await lastfm("track.getTopTags", { artist, track, autocorrect: "1" });
    const arr = d?.toptags?.tag || [];
    return arr.map((t) => t.name.toLowerCase());
  });
}

export function getArtistTopTracks(artist, limit = 50, page = 1) {
  return memo(`atop:${artist}:${limit}:${page}`, async () => {
    const d = await lastfm("artist.getTopTracks", {
      artist,
      limit: String(limit),
      page: String(page),
      autocorrect: "1",
    });
    const arr = d?.toptracks?.track || [];
    return arr.map((t, i) => ({
      track: t.name,
      artist: t.artist?.name || artist,
      listeners: Number(t.listeners) || 0,
      playcount: Number(t.playcount) || 0,
      rank: i,
    }));
  });
}

export function getArtistSimilar(artist, limit = 12) {
  return memo(`asim:${artist}`, async () => {
    const d = await lastfm("artist.getSimilar", { artist, limit: String(limit), autocorrect: "1" });
    const arr = d?.similarartists?.artist || [];
    return arr.map((a) => a.name);
  });
}

export function getTagTopTracks(tag, limit = 30) {
  return memo(`tagtop:${tag}`, async () => {
    const d = await lastfm("tag.getTopTracks", { tag, limit: String(limit) });
    const arr = d?.tracks?.track || [];
    return arr.map((t) => ({
      track: t.name,
      artist: t.artist?.name || "",
      listeners: 0,
      match: 0.4,
    }));
  });
}

export function getArtistTopTags(artist) {
  return memo(`atags:${artist}`, async () => {
    const d = await lastfm("artist.getTopTags", { artist, autocorrect: "1" });
    const arr = d?.toptags?.tag || [];
    return arr.map((t) => t.name.toLowerCase());
  });
}

export function getTrackInfo(artist, track) {
  return memo(`tinfo:${artist}:${track}`, async () => {
    const d = await lastfm("track.getInfo", { artist, track, autocorrect: "1" });
    const t = d?.track;
    if (!t) return null;
    return {
      track: t.name,
      artist: t.artist?.name || artist,
      listeners: Number(t.listeners) || 0,
      tags: (t.toptags?.tag || []).map((x) => x.name.toLowerCase()),
      wiki: t.wiki?.summary ? stripHtml(t.wiki.summary) : "",
      album: t.album?.title || "",
    };
  });
}

export function getArtistInfo(artist) {
  return memo(`ainfo:${artist}`, async () => {
    const d = await lastfm("artist.getInfo", { artist, autocorrect: "1" });
    const a = d?.artist;
    if (!a) return null;
    return {
      artist: a.name,
      listeners: Number(a.stats?.listeners) || 0,
      tags: (a.tags?.tag || []).map((x) => x.name.toLowerCase()),
      bio: a.bio?.summary ? stripHtml(a.bio.summary) : "",
    };
  });
}

// Search autocomplete (artists + tracks).
//
// Primary source is the iTunes Search API, NOT Last.fm. Last.fm's *.search ranks
// by raw name relevance, so a partial query ("bohemian", "quee") returns obscure
// substring matches and the canonical popular hit often isn't in the returned
// pool at all — re-ranking by listeners can't fix what isn't there (you had to
// type almost the full "bohemian rhapsody" before Queen showed up). iTunes orders
// by its own popularity signal, so the obvious result (Queen, The Beatles,
// Bohemian Rhapsody) surfaces from the first couple of letters. Last.fm stays as
// a fallback for the rare case iTunes returns nothing.
const POOL = 15; // Last.fm fallback pool, re-ranked by listeners

function itunesSearch(term, entity, limit) {
  return memo(`itsrch:${entity}:${term}:${limit}`, async () => {
    const r = await fetch(
      `/api/itunes?term=${encodeURIComponent(term)}&entity=${entity}&limit=${limit}`
    );
    const d = await r.json();
    return d?.results || [];
  });
}

// strip remaster / live / version / year noise so duplicate pressings of the
// same song collapse into one suggestion (Queen has a dozen Bohemian Rhapsodys)
const TITLE_NOISE =
  /\s*[([][^)\]]*(remaster(ed)?|live|version|mono|stereo|deluxe|edit|single|album version|anniversary|\d{4})[^)\]]*[)\]]\s*/gi;
function cleanTitle(name) {
  return String(name || "")
    .replace(TITLE_NOISE, " ")
    .replace(/\s+-\s+.*\b(remaster(ed)?|live|version)\b.*$/i, "")
    .replace(/\s+-\s+(single|ep)$/i, "") // album/track suffixes like "Dark Side - Single"
    .replace(/\s+/g, " ")
    .trim();
}

export function searchArtists(q, limit = 6) {
  if (!q || q.trim().length < 2) return Promise.resolve([]);
  return memo(`asearch:${q}`, async () => {
    const it = await itunesSearch(q, "musicArtist", 25).catch(() => []);
    const seen = new Set();
    const names = [];
    for (const x of it) {
      const name = (x.artistName || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
      if (names.length >= limit) break;
    }
    if (names.length) return names;
    // fallback: Last.fm pool re-ranked by listeners
    const d = await lastfm("artist.search", { artist: q, limit: String(POOL) });
    const arr = d?.results?.artistmatches?.artist || [];
    return arr
      .map((a) => ({ name: a.name, listeners: Number(a.listeners) || 0 }))
      .sort((x, y) => y.listeners - x.listeners)
      .slice(0, limit)
      .map((a) => a.name);
  });
}

export function searchTracks(q, limit = 6) {
  if (!q || q.trim().length < 2) return Promise.resolve([]);
  return memo(`tsearch:${q}`, async () => {
    const it = await itunesSearch(q, "song", 25).catch(() => []);
    const seen = new Set();
    const out = [];
    for (const x of it) {
      const artist = (x.artistName || "").trim();
      const raw = (x.trackName || "").trim();
      if (!artist || !raw) continue;
      const track = cleanTitle(raw) || raw;
      const key = `${track.toLowerCase()}|${artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ track, artist });
      if (out.length >= limit) break;
    }
    if (out.length) return out;
    // fallback: Last.fm pool re-ranked by listeners
    const d = await lastfm("track.search", { track: q, limit: String(POOL) });
    const arr = d?.results?.trackmatches?.track || [];
    return arr
      .map((t) => ({ track: t.name, artist: t.artist, listeners: Number(t.listeners) || 0 }))
      .sort((x, y) => y.listeners - x.listeners)
      .slice(0, limit)
      .map(({ track, artist }) => ({ track, artist }));
  });
}

export function searchAlbums(q, limit = 6) {
  if (!q || q.trim().length < 2) return Promise.resolve([]);
  return memo(`alsearch:${q}`, async () => {
    // iTunes again: "abbey" → Abbey Road · The Beatles, "thrill" → real albums.
    // Last.fm returned junk "Abbey"/"Thrill" entries for the same queries.
    const it = await itunesSearch(q, "album", 25).catch(() => []);
    const seen = new Set();
    const out = [];
    for (const x of it) {
      const artist = (x.artistName || "").trim();
      const raw = (x.collectionName || "").trim();
      if (!artist || !raw) continue;
      const album = cleanTitle(raw) || raw;
      const key = `${album.toLowerCase()}|${artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ album, artist });
      if (out.length >= limit) break;
    }
    if (out.length) return out;
    // fallback: Last.fm album search
    const d = await lastfm("album.search", { album: q, limit: String(limit) });
    const arr = d?.results?.albummatches?.album || [];
    return arr.map((a) => ({ album: a.name, artist: a.artist }));
  });
}

// ---------- iTunes (artwork + 30s preview + year) ----------
export function itunesLookup(artist, track) {
  const key = `it:${artist}:${track}`;
  return memo(key, async () => {
    const term = `${artist} ${track}`.trim();
    const r = await fetch(`/api/itunes?term=${encodeURIComponent(term)}&entity=song&limit=5`);
    const d = await r.json();
    const results = d?.results || [];
    // prefer a studio result (not "live"/"remix") with both preview + art
    const pick =
      results.find(
        (x) =>
          x.previewUrl &&
          x.artworkUrl100 &&
          !/\b(live|remix|karaoke|tribute|cover)\b/i.test(x.trackName || "")
      ) ||
      results.find((x) => x.previewUrl && x.artworkUrl100) ||
      results[0];
    if (!pick) return null;
    return {
      artwork: (pick.artworkUrl100 || "").replace("100x100", "600x600") || null,
      preview: pick.previewUrl || null,
      year: (pick.releaseDate || "").slice(0, 4) || "",
      album: pick.collectionName || "",
      itunesArtist: pick.artistName || artist,
      itunesTrack: pick.trackName || track,
    };
  });
}

export function itunesAlbumArt(artist, album) {
  return memo(`ita:${artist}:${album}`, async () => {
    const term = `${artist} ${album}`.trim();
    const r = await fetch(`/api/itunes?term=${encodeURIComponent(term)}&entity=album&limit=3`);
    const d = await r.json();
    const pick = (d?.results || []).find((x) => x.artworkUrl100) || d?.results?.[0];
    return pick ? (pick.artworkUrl100 || "").replace("100x100", "600x600") : null;
  });
}

// Last.fm's own album art. Real covers for well-known albums (capped ~300px),
// but it also serves a grey-star placeholder for many — filter that out.
const LASTFM_ART_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";
function lastfmAlbumArt(artist, album) {
  return memo(`lfart:${artist}:${album}`, async () => {
    const d = await lastfm("album.getInfo", { artist, album, autocorrect: "1" });
    const imgs = d?.album?.image || [];
    // largest first, skip empty + the placeholder hash
    const url = [...imgs]
      .reverse()
      .map((i) => i["#text"])
      .find((u) => u && !u.includes(LASTFM_ART_PLACEHOLDER));
    return url || null;
  });
}

// MusicBrainz + Cover Art Archive, via our /api/coverart proxy (last resort).
function coverArtArchive(artist, album) {
  return memo(`caa:${artist}:${album}`, async () => {
    const r = await fetch(
      `/api/coverart?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`
    );
    const d = await r.json();
    return d?.url || null;
  });
}

// Resilient album cover: iTunes (600px) → Last.fm (300px) → Cover Art Archive
// (500px) → null (caller falls back to a gradient). Each source fail-soft, so one
// provider being down or rate-limited never blanks the cover if another has it.
export function albumCover(artist, album) {
  if (!artist || !album) return Promise.resolve(null);
  return memo(`cover:${artist}:${album}`, async () => {
    const it = await itunesAlbumArt(artist, album).catch(() => null);
    if (it) return it;
    const lf = await lastfmAlbumArt(artist, album).catch(() => null);
    if (lf) return lf;
    const ca = await coverArtArchive(artist, album).catch(() => null);
    return ca || null;
  });
}

// ---------- Wikipedia ----------
export function wikiSummary(title) {
  return memo(`wiki:${title}`, async () => {
    const r = await fetch(`/api/wiki?title=${encodeURIComponent(title)}`);
    const d = await r.json();
    if (!d || d.missing || !d.extract) return null;
    return {
      extract: d.extract,
      thumbnail: d.thumbnail?.source || null,
      url: d.content_urls?.desktop?.page || null,
    };
  });
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// YouTube full-song search link (spec 7.6 fallback)
export function youtubeSearchUrl(artist, track) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${artist} ${track} official audio`
  )}`;
}
