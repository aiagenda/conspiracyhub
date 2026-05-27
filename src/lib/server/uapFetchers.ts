/** Live UAP feed fetchers (Google News, AARO, FOIA RSS, Reddit). */

export type UapNewsItem = {
  title: string;
  url: string;
  source: string;
  pubDate: string;
  type: string;
};

const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

export async function fetchAARO(): Promise<UapNewsItem[]> {
  const results: UapNewsItem[] = [];
  try {
    const res = await fetch("https://www.aaro.mil/News-Releases", {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return results;
    const html = await res.text();
    for (const m of html.matchAll(/href="([^"]*(?:report|release|news)[^"]*)"[^>]*>([^<]+)</gi)) {
      const url = m[1].startsWith("http") ? m[1] : `https://www.aaro.mil${m[1]}`;
      const title = m[2].trim();
      if (title.length > 10 && title.length < 200) {
        results.push({ title, url, source: "AARO (Pentagon)", pubDate: "", type: "report" });
      }
    }
  } catch {
    /* optional */
  }
  return results.slice(0, 8);
}

export async function fetchBlackVaultFeed(): Promise<UapNewsItem[]> {
  try {
    const res = await fetch("https://www.theblackvault.com/documentarchive/category/ufos-extraterrestrials/feed/", {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const results: UapNewsItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      if (title && link) {
        results.push({
          title,
          url: link,
          source: "The Black Vault (FOIA)",
          pubDate: pub || new Date().toISOString(),
          type: "foia",
        });
      }
    }
    return results.slice(0, 12);
  } catch {
    return [];
  }
}

export async function fetchMuckRockUAP(): Promise<UapNewsItem[]> {
  try {
    const res = await fetch("https://www.muckrock.com/news/rss/?tag=ufo", {
      headers: { "User-Agent": "TheTheorist/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const results: UapNewsItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      if (title && link) {
        results.push({
          title,
          url: link,
          source: "MuckRock (FOIA)",
          pubDate: pub || new Date().toISOString(),
          type: "foia",
        });
      }
    }
    return results.slice(0, 8);
  } catch {
    return [];
  }
}

export async function fetchUAPNews(): Promise<UapNewsItem[]> {
  const queries = [
    "UAP UFO Pentagon",
    "UFO disclosure 2026",
    "PURSUE UAP files war.gov",
    "Pentagon UFO files batch release",
    "Ross Coulthart UAP UFO",
    "David Grusch UAP whistleblower",
    "Ryan Graves UAP pilot",
    "Chris Mellon UAP",
    "AARO UAP report",
    "UAP Congressional hearing",
    "FOIA UFO declassified",
    "Pentagon UFO file dump",
    "non-human intelligence craft",
    "UAP whistleblower secret program",
    "alien craft recovered government",
    "UFO sighting military pilot",
  ];
  const seen = new Set<string>();
  const results: UapNewsItem[] = [];
  await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(
          `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
          { headers: { "User-Agent": UA_BROWSER }, signal: AbortSignal.timeout(7000) },
        );
        if (!res.ok) return;
        const xml = await res.text();
        for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const x = m[1];
          const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
          const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
          const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
          const src = x.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim() ?? "";
          if (title && link && !seen.has(title)) {
            seen.add(title);
            results.push({
              title,
              url: link,
              source: src || "Google News",
              pubDate: pub || new Date().toISOString(),
              type: "news",
            });
          }
        }
      } catch {
        /* skip */
      }
    }),
  );
  return results.slice(0, 50);
}

export async function fetchRedditUAP(): Promise<UapNewsItem[]> {
  const results: UapNewsItem[] = [];
  for (const sub of ["UFOs", "UAP", "conspiracy"]) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.rss?limit=8`, {
        headers: { "User-Agent": "TheTheorist/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const x = m[1];
        const title = x.match(/<title[^>]*>(.*?)<\/title>/)?.[1]?.trim() ?? "";
        const link = x.match(/href="(https:\/\/www\.reddit\.com\/r\/[^"]+)"/)?.[1] ?? "";
        const pub = x.match(/<updated>(.*?)<\/updated>/)?.[1] ?? "";
        if (title && link && /uap|ufo|alien|craft|disclosure|pentagon|grusch|aaro/i.test(title)) {
          results.push({
            title,
            url: link,
            source: `r/${sub}`,
            pubDate: pub || new Date().toISOString(),
            type: "social",
          });
        }
      }
    } catch {
      /* skip */
    }
  }
  return results.slice(0, 10);
}

/** All sources merged for news ingest (excludes FOIA feeds — those go to documents). */
export async function fetchAllUapNewsSources(): Promise<UapNewsItem[]> {
  const [aaro, news, reddit] = await Promise.all([fetchAARO(), fetchUAPNews(), fetchRedditUAP()]);
  return [...aaro, ...news, ...reddit];
}

/**
 * PURSUE — Pentagon UAP file portal (war.gov/UFO).
 * Batch releases drop every ~2 weeks. Falls back to Google News.
 */
export async function fetchPURSUE(): Promise<UapNewsItem[]> {
  const results: UapNewsItem[] = [];

  // Primary: scrape war.gov/UFO
  try {
    const res = await fetch("https://www.war.gov/UFO/", {
      headers: { "User-Agent": UA_BROWSER, "Accept": "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      for (const m of html.matchAll(/href="([^"]*(?:DOW-UAP|dow-uap|PURSUE|pursue)[^"]*\.(pdf|mp4|png|jpg)?)"/gi)) {
        const rawUrl = m[1];
        const url = rawUrl.startsWith("http") ? rawUrl : `https://www.war.gov${rawUrl}`;
        const filename = url.split("/").pop() ?? url;
        const title = filename
          .replace(/\.(pdf|mp4|png|jpg)$/i, "")
          .replace(/[-_]/g, " ")
          .replace(/DOW UAP PR(\d+)/i, "PURSUE Unresolved UAP Report #$1")
          .trim();
        if (title.length > 4) {
          results.push({ title: `[PURSUE] ${title}`, url, source: "PURSUE (war.gov/UFO)", pubDate: new Date().toISOString(), type: "foia" });
          if (results.length >= 20) break;
        }
      }
    }
  } catch { /* fallthrough */ }

  // Fallback: Google News
  if (results.length < 3) {
    try {
      for (const q of ["PURSUE UAP files war.gov 2026", "Pentagon UFO files release batch 2026"]) {
        const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, {
          headers: { "User-Agent": UA_BROWSER }, signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) continue;
        const xml = await res.text();
        for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const x = m[1];
          const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
          const link  = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
          const pub   = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
          if (title && link && /pursue|war\.gov|ufo.*file|uap.*release|pentagon.*ufo/i.test(title)) {
            results.push({ title, url: link, source: "PURSUE News", pubDate: pub || new Date().toISOString(), type: "foia" });
          }
        }
        if (results.length >= 5) break;
      }
    } catch { /* skip */ }
  }
  return results.slice(0, 25);
}

/** FOIA RSS feeds for document ingest. */
export async function fetchAllUapDocumentFeeds(): Promise<UapNewsItem[]> {
  const [blackvault, muckrock, pursue] = await Promise.all([fetchBlackVaultFeed(), fetchMuckRockUAP(), fetchPURSUE()]);
  return [...pursue, ...blackvault, ...muckrock];
}
