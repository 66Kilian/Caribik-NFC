// Vercel Routing Middleware: Slugs, Subdomains, an/aus, Weiterleitungen.
// Die Konfiguration wird beim Deploy mitgebündelt; jede Änderung im Admin
// ist ein Commit und löst einen neuen Deploy aus.
import sitesConfig from "./data/sites.json";
import { decide, OFFLINE_HTML, ROOT_DOMAIN_DEFAULT } from "./lib/route.js";
import { isAdminRequest } from "./lib/session.js";

export const config = {
  matcher: "/:path*",
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const secret = process.env.ADMIN_SESSION_SECRET;
  const isAdmin = await isAdminRequest(request.headers.get("cookie"), secret);
  const d = decide({
    pathname: url.pathname,
    search: url.search,
    host: request.headers.get("host") || url.host,
    config: sitesConfig,
    isAdmin,
    rootDomain: process.env.ROOT_DOMAIN || ROOT_DOMAIN_DEFAULT,
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
  return new Response(null, { headers: { "x-middleware-next": "1" } });
}
