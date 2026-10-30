/**
 * Paste into the browser console on any https://www.cia.gov/readingroom/ page.
 * See docs/cia-reading-room-harvest.md for why this cannot run on a server.
 *
 *   __harvest(__TOPICS, 25, 2)   // terms, max pages each, concurrency
 *   __h                          // progress
 *   __export()                   // hands the rows to the local sink
 */
(() => {
  const KEY = "__harvest_rows";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.__rows = [];
  window.__seen = new Set();
  window.__h = { topicsDone: 0, pages: 0, rows: 0, blocked: 0, errors: 0, running: false };

  // Rows are mirrored to localStorage because re-arming a blocked session means
  // navigating within the site, which would otherwise throw the harvest away.
  try {
    for (const row of JSON.parse(localStorage.getItem(KEY) || "[]")) {
      if (!window.__seen.has(row[0])) { window.__seen.add(row[0]); window.__rows.push(row); }
    }
  } catch { /* first run */ }
  window.__h.rows = window.__rows.length;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(window.__rows)); } catch { /* quota */ } };

  const parse = (html, topic) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = doc.querySelectorAll("ol.search-results > li");
    let added = 0;
    for (const li of items) {
      const a = li.querySelector("h3.title a");
      const match = (a?.getAttribute("href") || "").match(/\/readingroom\/document\/([^?#]+)/);
      if (!match || window.__seen.has(match[1])) continue;
      window.__seen.add(match[1]);
      const snippet = li.querySelector("p.search-snippet");
      window.__rows.push([
        match[1],
        a.textContent.replace(/\s+/g, " ").trim().slice(0, 200),
        snippet ? snippet.textContent.replace(/\s+/g, " ").trim().slice(0, 220) : "",
        topic,
      ]);
      added += 1;
    }
    return { added, listed: items.length };
  };

  window.__harvest = async (topics, maxPages, concurrency) => {
    const h = window.__h;
    h.running = true;
    const queue = topics.slice();
    const worker = async () => {
      while (queue.length) {
        const topic = queue.shift();
        for (let page = 0; page < maxPages; page += 1) {
          let tries = 0;
          let ok = false;
          while (tries < 6 && !ok) {
            let res;
            try {
              res = await fetch(
                `/readingroom/search/site/${encodeURIComponent(topic)}${page ? `?page=${page}` : ""}`,
                { credentials: "include" },
              );
            } catch { h.errors += 1; tries += 1; await sleep(5000); continue; }
            // 403 is the rate limiter, not the end of the results.
            if (res.status === 403) { h.blocked += 1; tries += 1; await sleep(45000); continue; }
            const { listed } = parse(await res.text(), topic);
            h.pages += 1;
            h.rows = window.__rows.length;
            ok = true;
            if (h.pages % 20 === 0) save();
            if (!listed) page = maxPages;
          }
          if (!ok) page = maxPages;
          await sleep(900);
        }
        h.topicsDone += 1;
        save();
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    h.running = false;
    save();
  };

  window.__export = async () => {
    const text = window.__rows
      .map(([id, title, snippet, topic]) => JSON.stringify({ id, title, snippet, topic }))
      .join("\n");
    const gzipped = await new Response(
      new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer();
    const bytes = new Uint8Array(gzipped);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    // Only top-level navigation reaches a private address from an https page.
    location.href = `http://127.0.0.1:8899/blob?d=${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_")}`;
  };

  window.__TOPICS = [
    "MKULTRA", "remote viewing", "STARGATE", "GRILL FLAME", "SUN STREAK", "CENTER LANE",
    "Project Bluebird", "ARTICHOKE", "parapsychology", "psychokinesis", "telepathy",
    "extrasensory perception", "mind control", "behavioral modification", "LSD experiments",
    "unidentified flying object", "flying saucer", "Roswell", "Project Blue Book",
    "Majestic 12", "UFO sightings", "unidentified aerial phenomena", "COINTELPRO",
    "Operation Mockingbird", "Phoenix Program", "Operation Paperclip", "Bay of Pigs",
    "Lee Harvey Oswald", "Kennedy assassination", "MHCHAOS", "Operation Northwoods",
    "Gulf of Tonkin", "Area 51", "OXCART", "U-2 overflight", "Church Committee",
    "Family Jewels", "biological warfare", "chemical warfare", "Operation Gladio",
    "Iran-Contra", "Nazi war criminals", "Amelia Earhart", "human radiation",
    "weather modification", "ionospheric research", "Martin Luther King",
    "Robert F Kennedy", "POW MIA", "secret writing", "Berlin Tunnel", "Guatemala 1954",
    "Doctor Zhivago", "Rosenberg atomic", "missile gap", "drug trafficking",
    "assassination plots", "Castro", "Lumumba", "Allende", "psychotronic",
    "hypnosis research", "truth serum", "interrogation techniques", "defector debriefing",
    "Soviet psychic research", "poltergeist", "dowsing", "precognition", "clairvoyance",
  ];
  return `installed — ${window.__rows.length} rows restored`;
})();
