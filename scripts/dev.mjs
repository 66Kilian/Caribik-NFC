// Lokaler Server, der Vercel nachbildet: Middleware + /api + statische Dateien.
//   MK_LOCAL_REPO=/pfad/zu/klon node scripts/dev.mjs
// Ohne MK_LOCAL_REPO wird das aktuelle Repo verwendet (Admin-Speichern = lokaler Git-Commit).
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decide, OFFLINE_HTML } from "../lib/route.js";
import { isAdminRequest } from "../lib/session.js";

const HERE = resolve(fileURLToPath(import.meta.url), "../..");
process.env.MK_LOCAL_REPO ||= HERE;
const ROOT = process.env.MK_LOCAL_REPO; // Dateien werden aus dem (Test-)Repo ausgeliefert
const PORT = Number(process.env.PORT || 3000);

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".vcf": "text/vcard; charset=utf-8", ".gif": "image/gif", ".txt": "text/plain", ".xml": "application/xml" };

async function serveStatic(pathname, res) {
  let p = decodeURIComponent(pathname);
  if (p.endsWith("/")) p += "index.html";
  const base = p.startsWith("/admin/") ? HERE : ROOT; // Admin-Code immer aus diesem Checkout
  const file = join(base, p);
  if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
  try {
    const s = await stat(file);
    if (s.isDirectory()) return serveStatic(pathname + "/", res);
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("404");
  }
}

async function runApi(url, req, res) {
  const name = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  if (!/^[a-z/]+$/.test(name) || name.includes("_lib")) { res.writeHead(404).end(); return; }
  let mod;
  try { mod = await import(pathToFileURL(join(HERE, "api", name + ".js")).href); }
  catch { res.writeHead(404).end(); return; }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  req.body = raw && /json/.test(req.headers["content-type"] || "") ? JSON.parse(raw) : raw;
  req.query = Object.fromEntries(url.searchParams);
  await mod.default(req, res);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const config = JSON.parse(await readFile(join(ROOT, "data/sites.json"), "utf8"));
    const isAdmin = await isAdminRequest(req.headers.cookie, process.env.ADMIN_SESSION_SECRET);
    const d = decide({ pathname: url.pathname, search: url.search, host: req.headers.host, config, isAdmin, rootDomain: process.env.ROOT_DOMAIN || "meinekontaktkarte.test" });
    if (d.type === "redirect") { res.writeHead(308, { Location: d.path }).end(); return; }
    if (d.type === "notfound") { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }).end(OFFLINE_HTML); return; }
    if (d.type === "rewrite") return serveStatic(d.path, res);
    if (url.pathname.startsWith("/api/")) return runApi(url, req, res);
    return serveStatic(url.pathname, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => console.log(`dev: http://localhost:${PORT}  (repo: ${ROOT})`));
