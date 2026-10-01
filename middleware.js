// Vercel Routing Middleware: Slugs, Subdomains, an/aus, Weiterleitungen.
// Die Konfiguration (data/sites.js, vom Admin erzeugt) wird beim Deploy
// mitgebündelt; jede Änderung im Admin ist ein Commit → neuer Deploy.
import sitesConfig from "./data/sites.js";
import { decide, OFFLINE_HTML, ROOT_DOMAIN_DEFAULT } from "./lib/route.js";
import { isAdminRequest } from "./lib/session.js";

export const config = {
  matcher: "/:path*",
};

function envVar(name) {
  try { return (typeof process !== "undefined" && process.env && process.env[name]) || ""; } catch { return ""; }
}

const pass = () => new Response(null, { headers: { "x-middleware-next": "1" } });

export default async function middleware(request) {
  // Fällt hier irgendetwas aus, wird die Anfrage einfach durchgereicht –
  // die Website darf wegen der Middleware nie komplett ausfallen.
  try {
    const url = new URL(request.url);
    let isAdmin = false;
    try { isAdmin = await isAdminRequest(request.headers.get("cookie"), envVar("ADMIN_SESSION_SECRET")); } catch {}
    const d = decide({
      pathname: url.pathname,
      search: url.search,
      host: request.headers.get("host") || url.host,
      config: sitesConfig,
      isAdmin,
      rootDomain: envVar("ROOT_DOMAIN") || ROOT_DOMAIN_DEFAULT,
    });

    if (d.type === "rewrite") {
      return new Response(null, { headers: { "x-middleware-rewrite": new URL(d.path, url).toString() } });
    }
    if (d.type === "redirect") {
      return new Response(null, { status: 308, headers: { Location: new URL(d.path, url).toString() } });
    }
    if (d.type === "notfound") {
      return new Response(OFFLINE_HTML, {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-store" },
      });
    }
    return pass();
  } catch {
    return pass();
  }
}
