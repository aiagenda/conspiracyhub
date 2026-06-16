/**
 * Image host allowlist for next/image optimization.
 *
 * News images in this app come from arbitrary upstream sources (Guardian, GNews,
 * RSS publishers, Reddit…), so we cannot enumerate every host. Next's optimizer
 * rejects any host not present in `images.remotePatterns` with a 400, which is why
 * these images were historically rendered with `unoptimized`.
 *
 * Strategy: optimize the known, high-volume, stable hosts (Guardian, Reddit,
 * gov media, etc.) and fall back to `unoptimized` for everything else. This is a
 * strict improvement with zero regression risk — unknown hosts render exactly as
 * before, allowlisted hosts now get resizing + AVIF/WebP transcoding + caching.
 *
 * Keep this list in sync with `images.remotePatterns` in `next.config.ts`.
 */

/** Hostnames (and `*.suffix` wildcards) whose images Next is allowed to optimize. */
const OPTIMIZABLE_HOST_SUFFIXES = [
  "media.guim.co.uk",
  "i.guim.co.uk",
  "uploads.guim.co.uk",
  "redd.it", // i.redd.it, preview.redd.it, external-preview.redd.it
  "media.defense.gov",
  "githubusercontent.com",
  "ytimg.com",
] as const;

/**
 * Returns true when `next/image` can optimize the given URL (host is allowlisted).
 * Returns false for unknown/arbitrary hosts so the caller can pass `unoptimized`.
 */
export function canOptimizeImage(src: string | null | undefined): boolean {
  if (!src) return false;
  let host: string;
  try {
    host = new URL(src).hostname.toLowerCase();
  } catch {
    return false;
  }
  // Match exact host or a dot-bounded subdomain only, to stay consistent with the
  // `**.suffix` remotePatterns (so "evilredd.it" does NOT match "redd.it").
  return OPTIMIZABLE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith("." + suffix),
  );
}
