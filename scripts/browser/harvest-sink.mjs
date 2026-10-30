// The browser pane cannot reach 127.0.0.1 with fetch/XHR/img/iframe — Chrome's
// Private Network Access blocks every subresource from an https page. Top-level
// navigation is not blocked, so the harvester hands its payload over as one very
// large GET, gzipped and base64url-encoded to fit.
import { createServer } from "node:http";
import { writeFileSync, appendFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const DIR = new URL(".", import.meta.url).pathname;
const LOG = DIR + "sink.log";
appendFileSync(LOG, `--- sink start ${new Date().toISOString()}\n`);

createServer((req, res) => {
  const [path, query = ""] = req.url.split("?");
  const html = (body) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!doctype html><meta charset=utf-8><body>${body}`);
  };
  if (path === "/blob") {
    const d = new URLSearchParams(query).get("d") ?? "";
    try {
      const raw = gunzipSync(Buffer.from(d.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString();
      const name = `${DIR}rows-${Date.now()}.jsonl`;
      writeFileSync(name, raw.endsWith("\n") ? raw : raw + "\n");
      const lines = raw.split("\n").filter(Boolean).length;
      appendFileSync(LOG, `BLOB ${lines} lines -> ${name}\n`);
      return html(`OK ${lines}`);
    } catch (e) {
      appendFileSync(LOG, `BLOB ERROR ${e.message} (len ${d.length})\n`);
      return html(`ERR ${e.message}`);
    }
  }
  appendFileSync(LOG, `GET ${path}\n`);
  html("ok");
}).listen(8899, "127.0.0.1", () => console.log("sink ready on 8899"));
