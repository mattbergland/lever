// This limiter is per-instance and best effort on serverless deployments.
const timestampsByKey = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (timestampsByKey.get(key) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (timestamps.length >= limit) {
    timestampsByKey.set(key, timestamps);
    const retryAfterSec = Math.max(
      1,
      Math.ceil((timestamps[0] + windowMs - now) / 1000),
    );
    return { ok: false, retryAfterSec };
  }

  timestamps.push(now);
  if (!timestampsByKey.has(key) && timestampsByKey.size >= MAX_KEYS) {
    const oldestKey = timestampsByKey.keys().next().value;
    if (oldestKey !== undefined) timestampsByKey.delete(oldestKey);
  }
  timestampsByKey.set(key, timestamps);
  return { ok: true, retryAfterSec: 0 };
}
