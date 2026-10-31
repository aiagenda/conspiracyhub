/**
 * Second pass over the CIA reading room: find the scan behind a pre-CREST record.
 *
 * CREST records are named after their ESDN (CIA-RDP96-00788R002000150002-3.pdf), so
 * their PDF can be derived. The older releases are not — the attachment is named after
 * the document's own title plus an internal node id, e.g.
 * "DESTRUCTION OF DRUG AND TOXIN RELATED FILES[12884391].pdf" — so the only way to
 * learn it is to read the record page. Paste on a reading-room page, then:
 *
 *   __resolveInit([...ids])   // ids only need to be supplied once; they persist
 *   __resolve(2500)           // one request at a time, resumable after a block
 *   __resolveExport()         // hands {id, pdf} pairs to the local sink
 */
(() => {
  const IDS = "__pdf_ids", OUT = "__pdf_found", CUR = "__pdf_cursor";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };

  const h = window.__p = {
    ids: read(IDS, []),
    found: read(OUT, []),
    cursor: Number(localStorage.getItem(CUR) || 0),
    missing: 0, paused: false, running: false, reason: "",
  };
  const save = () => {
    try {
      localStorage.setItem(OUT, JSON.stringify(h.found));
      localStorage.setItem(CUR, String(h.cursor));
    } catch { /* quota */ }
  };

  window.__resolveInit = (ids) => {
    h.ids = ids; h.cursor = 0; h.found = [];
    localStorage.setItem(IDS, JSON.stringify(ids));
    save();
    return `${ids.length} records queued`;
  };

  window.__resolve = async (delay = 2500) => {
    if (h.running) return "already running";
    h.running = true; h.paused = false; h.reason = "";
    while (h.cursor < h.ids.length) {
      const id = h.ids[h.cursor];
      let res, text;
      try {
        res = await fetch(`/readingroom/document/${encodeURIComponent(id)}`, { credentials: "include" });
        text = await res.text();
      } catch { h.paused = true; h.reason = "network"; h.running = false; save(); return "paused"; }
      // The rate limiter answers 200 with a ~2 KB challenge, so length is the real tell.
      if (res.status === 403 || text.length < 6000) {
        h.paused = true; h.reason = "blocked"; h.running = false; save(); return "paused";
      }
      const match = text.match(/href="([^"]*\/readingroom\/docs\/[^"]+\.pdf)"/i);
      if (match) h.found.push([id, match[1]]); else h.missing += 1;
      h.cursor += 1;
      if (h.cursor % 10 === 0) save();
      await sleep(delay);
    }
    h.running = false; save();
    return "done";
  };

  window.__resolveExport = async () => {
    const text = h.found.map(([id, pdf]) => JSON.stringify({ id, pdf })).join("\n");
    const buf = await new Response(
      new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    // Only top-level navigation reaches a private address from an https page.
    location.href = `http://127.0.0.1:8899/blob?d=${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_")}`;
  };

  return `installed — ${h.found.length} found, cursor ${h.cursor}/${h.ids.length}`;
})();
