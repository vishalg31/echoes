// Tiny in-memory cache for server route handlers. Persists per warm serverless
// instance — enough to soften API rate limits (iTunes ~20/min/IP, Last.fm 5/s).

const store = new Map();

export async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && now - hit.t < ttlMs) return hit.v;
  const v = await fn();
  store.set(key, { t: now, v });
  // light eviction so the map can't grow unbounded
  if (store.size > 500) {
    const cutoff = now - ttlMs;
    for (const [k, e] of store) if (e.t < cutoff) store.delete(k);
  }
  return v;
}
