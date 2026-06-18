import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

const KEY = process.env.LASTFM_API_KEY;
const BASE = "https://ws.audioscrobbler.com/2.0/";
const TTL = 1000 * 60 * 60 * 6; // 6h — catalogue/similarity data is stable
// CDN cache so the edge absorbs repeat queries (catalogue/similarity is stable),
// keeping us well under Last.fm's ~5 req/sec/IP and honouring their "please cache" ToS.
const CDN_CACHE = "public, s-maxage=21600, stale-while-revalidate=86400"; // 6h + 1d swr

const ALLOWED = new Set([
  "track.getSimilar",
  "track.getTopTags",
  "track.getInfo",
  "track.search",
  "artist.getTopTracks",
  "artist.getSimilar",
  "artist.getInfo",
  "artist.getTopTags",
  "artist.search",
  "album.search",
  "album.getInfo",
  "tag.getTopTracks",
]);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const method = searchParams.get("method");

  if (!method || !ALLOWED.has(method)) {
    return NextResponse.json({ error: "Unsupported method" }, { status: 400 });
  }
  if (!KEY) {
    return NextResponse.json({ error: "LASTFM_API_KEY not set" }, { status: 500 });
  }

  const params = new URLSearchParams(searchParams);
  params.set("api_key", KEY);
  params.set("format", "json");
  const url = `${BASE}?${params.toString()}`;
  const cacheKey = url; // includes everything but the (constant) key

  try {
    const data = await cached(cacheKey, TTL, async () => {
      const r = await fetch(url, { headers: { "User-Agent": "Echoes/0.1 (vishalbuilds.com)" } });
      return r.json();
    });
    return NextResponse.json(data, { headers: { "Cache-Control": CDN_CACHE } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
