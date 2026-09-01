// Runs the real Netlify function handlers behind a plain Node server, so the tests
// exercise the code that gets deployed rather than a reimplementation of it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.Netlify = { env: { get: (k) => process.env[k] } };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "public");
const FN = path.join(HERE, "..", "netlify", "functions");
const PORT = Number(process.env.PORT || 8901);

const handlers = {};
for (const f of ["auth", "me", "entries", "villages"]) {
  const mod = await import(path.join(FN, f + ".mjs"));
  handlers[mod.config.path] = mod.default;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

http
  .createServer(async (nreq, nres) => {
    const url = new URL(nreq.url, "http://localhost:" + PORT);

    const fn = handlers[url.pathname];
    if (fn) {
      const chunks = [];
      for await (const c of nreq) chunks.push(c);
      const init = { method: nreq.method, headers: nreq.headers };
      if (chunks.length) init.body = Buffer.concat(chunks);
      const res = await fn(new Request(url.href, init));
      nres.writeHead(res.status, Object.fromEntries(res.headers));
      nres.end(Buffer.from(await res.arrayBuffer()));
      return;
    }

    const file = path.join(ROOT, url.pathname === "/" ? "/index.html" : url.pathname);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      nres.writeHead(404);
      nres.end("not found");
      return;
    }
    nres.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
    });
    nres.end(fs.readFileSync(file));
  })
  .listen(PORT, () => {
    fs.writeFileSync(path.join(HERE, ".server.pid"), String(process.pid));
    console.log("test server on " + PORT);
  });
