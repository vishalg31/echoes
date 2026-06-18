import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

const TTL = 1000 * 60 * 60 * 24; // 24h — track metadata never changes

// CDN cache so repeat queries ("bohem", "quee", …) are served from Vercel's edge
// instead of invoking this function or calling Apple — the real protection against
// iTunes' ~20 req/min/IP limit (the limit applies to our shared server IP).
const CDN_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800"; // 24h + 7d swr

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  // lowercase the term: iTunes is case-insensitive, so "Queen" and "queen" should
  // hit the same cache entry rather than fetch twice.
  const term = (searchParams.get("term") || "").trim().toLowerCase();
  if (!term) {
    return NextResponse.json({ error: "Missing term" }, { status: 400 });
  }
  const entity = searchParams.get("entity") || "song";
  const limit = searchParams.get("limit") || "8";
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&media=music&entity=${encodeURIComponent(entity)}&limit=${encodeURIComponent(limit)}`;

  try {
    const data = await cached(url, TTL, async () => {
      const r = await fetch(url);
      return r.json();
    });
    return NextResponse.json(data, { headers: { "Cache-Control": CDN_CACHE } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
