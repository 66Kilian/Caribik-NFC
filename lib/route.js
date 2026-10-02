// Routing für meinekontaktkarte.com – reine Funktion, damit sie in der
// Vercel-Middleware und im lokalen Dev-Server identisch läuft.

export const ROOT_DOMAIN_DEFAULT = "meinekontaktkarte.com";

// Pfade, die niemals als Slug vergeben werden dürfen.
export const RESERVED_SLUGS = [
  "admin", "api", "data", "lib", "img", "scripts", "munkak", "munkák",
  "favicon.ico", "favicon.svg", "robots.txt", "sitemap.xml", "i18n.js",
  "index.html", "www", "mail", "static", "assets", "_vercel", "404",
];

// Dateien/Ordner im Repo, die öffentlich nicht abrufbar sein sollen.
const PRIVATE_PREFIXES = ["/data/", "/lib/", "/scripts/", "/Munkák/", "/.git"];
const PRIVATE_FILES = new Set([
  "/middleware.js", "/package.json", "/package-lock.json", "/vercel.json",
  "/ADMIN.md", "/README.md", "/.gitignore",
]);

export function encodePath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

function safeDecode(p) {
  try { return decodeURIComponent(p).normalize("NFC"); } catch { return p; }
}

/**
 * @returns {{type:"next"}|{type:"rewrite",path:string}|{type:"redirect",path:string}|{type:"notfound"}}
 */
// Kunden-Admin jeder Seite: /<slug>/admin/ (gleiche App für alle, Seite aus der URL).
export const CLIENT_APP = "/admin/client.html";

export function decide({ pathname, search = "", host = "", config, isAdmin = false, clientSite = null, rootDomain = ROOT_DOMAIN_DEFAULT }) {
  const sites = (config && config.sites) || [];
  const path = safeDecode(pathname);
  host = String(host).toLowerCase().replace(/:\d+$/, "");

  // Admin & API laufen nur über die Hauptdomain / Vercel-Domains.
  const sub = subdomainOf(host, rootDomain);
  if (sub) {
    const site = sites.find(s => s.subdomain && s.subdomain === sub && s.folder);
    if (site && /^\/admin(\/|$)/.test(path)) return { type: "redirect", path: `https://${rootDomain}/${site.slug}/admin/` };
    if (!site || (!site.enabled && !isAdmin && clientSite !== site.id)) return { type: "notfound" };
    let rest = path.replace(/^\/+/, "");
    if (rest === "" || rest.endsWith("/")) rest += "index.html";
    return { type: "rewrite", path: "/" + encodePath(site.folder + "/" + rest) };
  }

  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/")) return { type: "next" };

  if (!isAdmin && (PRIVATE_FILES.has(path) || PRIVATE_PREFIXES.some(p => path.startsWith(p)))) {
    return { type: "notfound" };
  }

  const m = path.match(/^\/([^/]+)(\/.*)?$/);
  if (!m) return { type: "next" };
  const seg = m[1].toLowerCase();
  const rest = m[2];

  const site = sites.find(s => s.slug && s.slug === seg && s.folder);
  if (site) {
    if (rest === undefined) return { type: "redirect", path: "/" + site.slug + "/" + search };
    if (rest === "/admin") return { type: "redirect", path: "/" + site.slug + "/admin/" + search };
    if (rest.startsWith("/admin/")) return { type: "rewrite", path: CLIENT_APP };
    if (!site.enabled && !isAdmin && clientSite !== site.id) return { type: "notfound" };
    let r = rest.replace(/^\/+/, "");
    if (r === "" || r.endsWith("/")) r += "index.html";
    return { type: "rewrite", path: "/" + encodePath(site.folder + "/" + r) };
  }

  // Alte Adressen (z. B. schon auf NFC-Karten gedruckt) leiten weiter.
  const moved = sites.find(s => s.slug && s.folder && (s.aliases || []).includes(seg));
  if (moved) return { type: "redirect", path: "/" + moved.slug + (rest || "/") + search };

  return { type: "next" };
}

export function subdomainOf(host, rootDomain) {
  if (!host || !rootDomain) return null;
  if (host === rootDomain || host === "www." + rootDomain) return null;
  if (!host.endsWith("." + rootDomain)) return null;
  const sub = host.slice(0, -rootDomain.length - 1);
  return sub.includes(".") ? null : sub;
}

export const OFFLINE_HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Nicht verfügbar</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e10;color:#f2f2f2;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}a{color:#8ab4ff}</style></head>
<body><div><h1 style="font-size:22px;margin:0 0 8px">Diese Seite ist derzeit nicht verfügbar.</h1><p style="opacity:.7;margin:0 0 18px">This page is currently unavailable.</p><a href="https://meinekontaktkarte.com/">meinekontaktkarte.com</a></div></body></html>`;
