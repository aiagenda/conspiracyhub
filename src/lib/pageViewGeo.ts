import type { NextRequest } from "next/server";

/** Vercel / edge geo headers at request time (null locally or without geo). */
export function pageViewGeoFromRequest(req: NextRequest): {
  country_code: string | null;
  region: string | null;
} {
  const rawCountry =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    "";
  const country = rawCountry.trim().toUpperCase().slice(0, 2);
  const country_code = country.length === 2 && country !== "XX" ? country : null;

  const regionRaw = req.headers.get("x-vercel-ip-country-region")?.trim() ?? "";
  const region = regionRaw.length > 0 ? regionRaw.slice(0, 64) : null;

  return { country_code, region };
}
