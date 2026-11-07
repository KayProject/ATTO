// Per-IP limits for the public endpoints. Counts live in this server's memory, so each server instance counts alone.
interface Window {
  count: number;
  resets_at: number;
}

const MAX_TRACKED = 10_000;

export class RateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private limit: number,
    private window_ms: number,
    private now: () => number = Date.now,
  ) {}

  /** Records a request. Returns the seconds to wait if it's over the limit, otherwise null. */
  hit(key: string): number | null {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || window.resets_at <= now) {
      if (this.windows.size >= MAX_TRACKED) this.forgetExpired(now);
      window = { count: 0, resets_at: now + this.window_ms };
      this.windows.set(key, window);
    }
    window.count += 1;
    return window.count > this.limit ? Math.ceil((window.resets_at - now) / 1000) : null;
  }

  private forgetExpired(now: number) {
    for (const [key, window] of this.windows) if (window.resets_at <= now) this.windows.delete(key);
    // Still full of live windows: start over, rather than let the map grow without limit.
    if (this.windows.size >= MAX_TRACKED) this.windows.clear();
  }
}

/** The caller's address as the hosting proxy reports it. Without one, callers share a single count. */
export function clientKey(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// On globalThis because Next can bundle each route separately, and they have to share counts.
const store = globalThis as unknown as { __attoLimiters?: Map<string, RateLimiter> };
const limiters = (store.__attoLimiters ??= new Map());

function limiter(bucket: string, limit: number): RateLimiter {
  let found = limiters.get(bucket);
  if (!found) {
    found = new RateLimiter(limit, 60_000);
    limiters.set(bucket, found);
  }
  return found;
}

export const CHECK_API_PER_MINUTE = 60;
export const LIVE_REPORTS_PER_MINUTE = 30;

/** The response to send if this request is over its per-minute limit, otherwise null. */
export function overLimit(
  request: Request,
  bucket: string,
  perMinute: number,
  headers: Record<string, string>,
): Response | null {
  const retry_after = limiter(bucket, perMinute).hit(clientKey(request.headers));
  if (retry_after === null) return null;
  return Response.json(
    { error: `Too many requests. Try again in ${retry_after} seconds.` },
    { status: 429, headers: { ...headers, "retry-after": String(retry_after) } },
  );
}
