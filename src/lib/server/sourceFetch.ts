import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function isPublicSourceAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a,b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  // Restrict IPv6 sources to global unicast. Local, mapped IPv4 and link-local are excluded.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address);
}

/** Check each redirect separately; research must not follow a source into a local service. */
export async function fetchPublicSource(raw: string, init: RequestInit = {}): Promise<Response> {
  let url = new URL(raw);
  const signal = init.signal ?? AbortSignal.timeout(12000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("invalid_source_url");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addresses.length || addresses.some(({address}) => !isPublicSourceAddress(address))) throw new Error("non_public_source");
    const response = await fetch(url, { ...init, signal, redirect: "manual" });
    if (![301,302,303,307,308].includes(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new Error("source_redirect_missing");
    url = new URL(location, url);
  }
  throw new Error("too_many_source_redirects");
}
