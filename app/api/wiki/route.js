import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

const TTL = 1000 * 60 * 60 * 24; // 24h

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, "_")
  )}`;

  try {
    const data = await cached(url, TTL, async () => {
      const r = await fetch(url, {
        headers: { "User-Agent": "Echoes/0.1 (vishalbuilds.com; vgvishal31@gmail.com)" },
      });
      if (!r.ok) return { missing: true, status: r.status };
      return r.json();
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
