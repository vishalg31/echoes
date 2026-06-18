import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

// Last-resort album cover source: resolve a release-group MBID via MusicBrainz,
// then hand back the Cover Art Archive front-image URL (CAA 307-redirects to the
// real image, which the browser follows for a CSS background). Keyless. Only ever
// hit when both iTunes AND Last.fm have no cover, so volume is tiny — well inside
// MusicBrainz's 1 req/sec limit. Cached hard (covers never change).
const TTL = 1000 * 60 * 60 * 24 * 7; // 7d
const CDN_CACHE = "public, s-maxage=604800, stale-while-revalidate=2592000"; // 7d + 30d swr
const UA = "Echoes/0.1 (vishalbuilds.com)"; // MusicBrainz requires a real UA

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const artist = (searchParams.get("artist") || "").trim();
  const album = (searchParams.get("album") || "").trim();
  if (!artist || !album) {
    return NextResponse.json({ error: "Missing artist/album" }, { status: 400 });
  }

  const query = `artist:"${artist}" AND releasegroup:"${album}"`;
  const mbUrl = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=1`;

  try {
    const url = await cached(`caa:${artist}:${album}`, TTL, async () => {
      const r = await fetch(mbUrl, { headers: { "User-Agent": UA } });
      const d = await r.json();
      const rg = (d?.["release-groups"] || [])[0];
      if (!rg?.id) return null;
      return `https://coverartarchive.org/release-group/${rg.id}/front-500`;
    });
    return NextResponse.json({ url }, { headers: { "Cache-Control": CDN_CACHE } });
  } catch (e) {
    // soft-fail: caller treats null as "no cover" and uses its gradient
    return NextResponse.json({ url: null, error: String(e) });
  }
}
