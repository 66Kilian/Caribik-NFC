// node scripts/test-route.mjs – prüft die Routing-Regeln.
import assert from "node:assert/strict";
import { decide } from "../lib/route.js";

const config = { sites: [
  { id: "main", folder: "", slug: "", enabled: true },
  { id: "caribik", folder: "Munkák/Caribik Sauna Club", slug: "caribik", subdomain: "sauna", enabled: true, aliases: ["cbk"] },
  { id: "venus", folder: "Munkák/Venus Nfc", slug: "venus", subdomain: "", enabled: false, aliases: [] },
] };
const d = (pathname, o = {}) => decide({ pathname, config, host: "meinekontaktkarte.com", ...o });
const C = "/Munk%C3%A1k/Caribik%20Sauna%20Club";

assert.deepEqual(d("/"), { type: "next" });
assert.deepEqual(d("/i18n.js"), { type: "next" });
assert.deepEqual(d("/caribik"), { type: "redirect", path: "/caribik/" });
assert.deepEqual(d("/caribik", { search: "?a=1" }), { type: "redirect", path: "/caribik/?a=1" });
assert.deepEqual(d("/caribik/"), { type: "rewrite", path: C + "/index.html" });
assert.deepEqual(d("/CARIBIK/img/logo.png"), { type: "rewrite", path: C + "/img/logo.png" });
assert.deepEqual(d("/cbk/"), { type: "redirect", path: "/caribik/" });
assert.deepEqual(d("/cbk"), { type: "redirect", path: "/caribik/" });
assert.deepEqual(d("/venus/"), { type: "notfound" });
assert.deepEqual(d("/venus/", { isAdmin: true }), { type: "rewrite", path: "/Munk%C3%A1k/Venus%20Nfc/index.html" });
assert.deepEqual(d("/Munk%C3%A1k/Venus%20Nfc/index.html"), { type: "notfound" });
assert.deepEqual(d("/Munk%C3%A1k/Venus%20Nfc/index.html", { isAdmin: true }), { type: "next" });
assert.deepEqual(d("/data/sites.json"), { type: "notfound" });
assert.deepEqual(d("/package.json"), { type: "notfound" });
assert.deepEqual(d("/admin/"), { type: "next" });
assert.deepEqual(d("/api/sites"), { type: "next" });
assert.deepEqual(d("/", { host: "sauna.meinekontaktkarte.com" }), { type: "rewrite", path: C + "/index.html" });
assert.deepEqual(d("/img/x.jpg", { host: "sauna.meinekontaktkarte.com:443" }), { type: "rewrite", path: C + "/img/x.jpg" });
assert.deepEqual(d("/", { host: "nope.meinekontaktkarte.com" }), { type: "notfound" });
assert.deepEqual(d("/admin/", { host: "sauna.meinekontaktkarte.com" }), { type: "rewrite", path: C + "/admin/index.html" });
assert.deepEqual(d("/", { host: "www.meinekontaktkarte.com" }), { type: "next" });
assert.deepEqual(d("/caribik/", { host: "caribik-nfc.vercel.app" }), { type: "rewrite", path: C + "/index.html" });
console.log("route: alle Tests ok");
