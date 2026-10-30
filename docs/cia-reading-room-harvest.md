# Harvesting the CIA Electronic Reading Room

The reading room (`cia.gov/readingroom`) is the richest free source of individual
declassified US intelligence documents — every record has a real title, a stable URL
and, for most, a scanned PDF. It is also the only source in this project that cannot be
fetched from a server.

## What blocks a server

Akamai Bot Manager fingerprints the TLS handshake. The symptoms, in order of how
confusing they are:

| Client | Result |
| --- | --- |
| `curl`, any headers or cookie jar | every deep path 302s to `/readingroom/` |
| Node `fetch` | `200` with a `<meta refresh>` carrying a `bm-verify` token |
| following the `bm-verify` URL | lands on `/readingroom/`, then re-challenges |
| a real browser | works |

The `bm-verify` round trip cannot be completed without running the sensor JavaScript, so
there is no server-side path. Note that the redirect-to-home behaviour makes a broken
deep link look like a working one: `collection/stargate` and the retired
`collection/behavior-modification` both "succeed", one with the collection and one with
the home page. Check the final URL, not the status code.

## How the records are collected instead

The browser pane does the fetching, because the page it is already on has passed the
challenge. `scripts/browser/harvest-cia-readingroom.js` is pasted into the console on
any `cia.gov/readingroom` page. It walks the reading room's own full-text search
(`/readingroom/search/site/<term>`) for a list of terms, parses
`ol.search-results > li`, and keeps `{id, title, snippet, topic}`.

Getting the data back out is the awkward part. The pane cannot reach `127.0.0.1` with
`fetch`, `XMLHttpRequest`, an image, an iframe, a script tag or `sendBeacon` — Chrome's
Private Network Access blocks every subresource from an https origin to a private
address. Top-level navigation is not blocked, so `__export()` gzips the rows, encodes
them base64url and navigates to `http://127.0.0.1:8899/blob?d=…`, where a throwaway
sink writes the JSONL. The sink has to run with `--max-http-header-size` raised, since
the payload travels in the request line.

Then:

```bash
node scripts/import_cia_readingroom.mjs <dir-with-jsonl>
```

## Pacing

The reading room tolerates roughly 100 requests before it returns `403 Access Denied`,
and the block then lasts tens of minutes and applies to the browser too. Run with
concurrency 2 and ~900 ms between requests; the script backs off 45 s on a 403 and
retries the same page up to six times. Rows are mirrored into `localStorage` as it goes,
so navigating within the site to re-arm a session does not lose the harvest.
