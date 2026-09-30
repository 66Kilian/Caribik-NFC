/* meinekontaktkarte.com – Admin
   Alles, was hier geändert wird, bleibt ein Entwurf (lokal gespeichert), bis
   „Közzététel“ gedrückt wird. Dann entsteht ein Git-Commit → Vercel deployt. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var ROOT_DOMAIN = "meinekontaktkarte.com";
  var RESERVED = ["admin", "api", "data", "lib", "img", "scripts", "munkak", "munkák", "favicon.ico", "favicon.svg", "robots.txt", "sitemap.xml", "i18n.js", "index.html", "www", "mail", "static", "assets", "_vercel", "404"];
  var NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
  var INLINE = { B: 1, I: 1, EM: 1, STRONG: 1, BR: 1, SPAN: 1, SMALL: 1, A: 1, U: 1, SUP: 1, SUB: 1, MARK: 1, S: 1 };
  var DRAFT_KEY = "mk-admin-draft";
  var IDLE_MS = 30 * 60 * 1000;

  var S = {
    config: null, configBase: "", configSha: null, discovered: [],
    pages: {}, cur: null, tab: "blocks", device: "mobile", editMode: true, sel: null,
    deploy: null, draftOffer: null, pendingImgs: {}
  };

  // ------------------------------------------------------------ Hilfen
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") el.textContent = v;
      else if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.append(x); }); else el.append(c);
    }
    return el;
  }
  function show(id) { ["vBoot", "vSetup", "vLogin", "vApp"].forEach(function (v) { $(v).classList.toggle("hidden", v !== id); }); }
  function toast(msg, bad) {
    var t = h("div", { class: "toast" + (bad ? " bad" : ""), text: msg, role: "status" });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, bad ? 6000 : 2600);
  }
  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString("hu-HU", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso; } }
  // Im Editor „&“ statt „&amp;“ zeigen; beim Speichern wieder korrekt kodieren.
  function toEditable(html) { return String(html).replace(/&nbsp;/g, "\u00a0").replace(/&amp;/g, "&"); }
  function fromEditable(v) { return String(v).replace(/&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#\d{1,7};|#x[0-9a-fA-F]{1,6};)/g, "&amp;").replace(/\u00a0/g, "&nbsp;"); }
  function slugify(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "oldal";
  }

  function api(path, body) {
    var opts = { credentials: "same-origin", headers: { "x-mk-admin": "1" } };
    if (body !== undefined) { opts.method = "POST"; opts.headers["content-type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch("/api/" + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path.indexOf("auth/") !== 0) { saveDraft(); showLogin("A munkamenet lejárt – jelentkezz be újra. A változtatásaid megmaradtak."); }
        if (!r.ok) { var e = new Error(j.error || ("Hiba " + r.status)); e.status = r.status; e.data = j; throw e; }
        return j;
      });
    });
  }

  function ask(title, body, yes, danger) {
    return new Promise(function (resolve) {
      $("dlgTitle").textContent = title;
      var b = $("dlgBody"); b.innerHTML = "";
      if (typeof body === "string") b.append(h("p", { class: "muted", text: body })); else if (body) b.append(body);
      $("dlgYes").textContent = yes || "OK";
      $("dlgYes").className = "btn " + (danger ? "danger" : "primary");
      $("dlgNo").classList.toggle("hidden", yes === null);
      var d = $("dlg");
      function done(v) { d.close(); $("dlgYes").onclick = $("dlgNo").onclick = null; resolve(v); }
      $("dlgYes").onclick = function () { done(true); };
      $("dlgNo").onclick = function () { done(false); };
      d.oncancel = function (e) { e.preventDefault(); done(false); };
      d.showModal();
    });
  }

  // ------------------------------------------------------------ Login
  var pre = null;
  function showLogin(msg) {
    show("vLogin");
    $("fPw").classList.remove("hidden"); $("fCode").classList.add("hidden"); $("lgStep2").classList.remove("on");
    $("lgErr1").textContent = msg || ""; $("lgPw").value = ""; $("lgPw").focus();
  }
  $("fPw").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.target.querySelector("button"); btn.disabled = true; $("lgErr1").textContent = "";
    api("auth/login", { password: $("lgPw").value }).then(function (j) {
      pre = j.pre; $("lgPw").value = "";
      $("fPw").classList.add("hidden"); $("fCode").classList.remove("hidden"); $("lgStep2").classList.add("on");
      $("lgCode").value = ""; $("lgErr2").textContent = ""; $("lgCode").focus();
    }).catch(function (err) { $("lgErr1").textContent = err.message; }).finally(function () { btn.disabled = false; });
  });
  $("fCode").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.target.querySelector("button[type=submit],button:not([type])"); btn.disabled = true;
    api("auth/verify", { pre: pre, code: $("lgCode").value }).then(function () {
      pre = null; startApp();
    }).catch(function (err) {
      if (err.data && err.data.restart) return showLogin(err.message);
      $("lgErr2").textContent = err.message; $("lgCode").select();
    }).finally(function () { btn.disabled = false; });
  });
  $("lgCode").addEventListener("input", function () {
    var v = this.value.replace(/\D/g, "");
    if (v.length === 6) $("fCode").requestSubmit();
  });
  $("lgBack").onclick = function () { showLogin(); };
  $("btnLogout").onclick = function () { logout(); };
  function logout(msg) {
    saveDraft();
    api("auth/logout", {}).catch(function () {}).then(function () { showLogin(msg); });
  }

  // Automatische Abmeldung bei Inaktivität
  var idleT;
  function bumpIdle() {
    clearTimeout(idleT);
    idleT = setTimeout(function () { if (!$("vApp").classList.contains("hidden")) logout("30 perc inaktivitás után automatikusan kiléptettünk."); }, IDLE_MS);
  }
  ["pointerdown", "keydown", "scroll"].forEach(function (ev) { document.addEventListener(ev, bumpIdle, { passive: true, capture: true }); });

  // ------------------------------------------------------------ Start
  function boot() {
    api("auth/status").then(function (s) {
      if (!s.configured) return show("vSetup");
      if (!s.loggedIn) return showLogin();
      startApp();
    }).catch(function (e) { show("vSetup"); toast(e.message, true); });
  }

  function startApp() {
    show("vApp"); bumpIdle();
    loadSites().then(function () {
      offerDraft();
      var want = (location.hash.match(/site=([\w-]+)/) || [])[1];
      var first = S.config.sites.find(function (s) { return s.id === want; }) || S.config.sites[0];
      if (first) openSite(first.id);
    }).catch(function (e) { toast(e.message, true); });
  }

  function loadSites() {
    return api("sites").then(function (j) {
      S.config = j.config; S.configBase = JSON.stringify(j.config); S.configSha = j.configSha; S.discovered = j.discovered || [];
      S.head = j.head;
      renderSide(); updateSaveBar();
    });
  }

  // ------------------------------------------------------------ Entwürfe
  var draftT;
  function saveDraftSoon() { clearTimeout(draftT); draftT = setTimeout(saveDraft, 400); }
  function saveDraft() {
    if (!S.config) return;
    var d = { at: new Date().toISOString(), configSha: S.configSha, pages: {} };
    if (JSON.stringify(S.config) !== S.configBase) d.config = S.config;
    Object.keys(S.pages).forEach(function (id) {
      var p = S.pages[id];
      if (!p.doc) return;
      var html = serialize(p), ov = JSON.stringify(p.overrides);
      if (html !== p.base || ov !== p.overridesBase) d.pages[id] = { html: html, htmlSha: p.htmlSha, overrides: p.overrides };
    });
    try {
      if (!d.config && !Object.keys(d.pages).length) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) { /* Speicher voll/gesperrt – Entwurf bleibt nur im Speicher */ }
  }
  function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; } }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  function offerDraft() {
    var d = readDraft();
    if (!d || (!d.config && !Object.keys(d.pages || {}).length)) return;
    var stale = d.configSha !== S.configSha;
    var list = h("ul", null,
      d.config ? h("li", { text: "Beállítások (címek, be/ki, csoportok)" }) : null,
      Object.keys(d.pages).map(function (id) {
        var s = S.config.sites.find(function (x) { return x.id === id; });
        return h("li", { text: (s ? s.name : id) + ": tartalom / szekciók" });
      }));
    var body = h("div", null,
      h("p", { class: "muted", text: "Mentetlen változtatásokat találtunk (" + fmtDate(d.at) + "):" }), list,
      stale ? h("p", { class: "err-text", text: "Figyelem: azóta más is mentett. Ha visszaállítod, a piszkozat felülírhatja azokat a változásokat." }) : null);
    ask("Folytatod, ahol abbahagytad?", body, "Visszaállítás").then(function (yes) {
      if (!yes) { clearDraft(); return; }
      if (d.config) { S.config = d.config; }
      S.draftPages = d.pages || {};
      renderSide(); updateSaveBar();
      if (S.cur) openSite(S.cur, true);
    });
  }

  // ------------------------------------------------------------ Sidebar
  function siteById(id) { return S.config.sites.find(function (s) { return s.id === id; }); }
  function baseSite(id) { return JSON.parse(S.configBase).sites.find(function (s) { return s.id === id; }); }
  function siteUrl(s) { return s.folder ? "https://" + ROOT_DOMAIN + "/" + s.slug + "/" : "https://" + ROOT_DOMAIN + "/"; }
  function siteChanged(s) {
    var b = baseSite(s.id), p = S.pages[s.id];
    return JSON.stringify(b) !== JSON.stringify(s) || !!(p && pageDirty(p));
  }

  function renderSide() {
    var q = $("q").value.trim().toLowerCase();
    var groups = (S.config.groups || []).slice();
    S.config.sites.forEach(function (s) { if (groups.indexOf(s.group) < 0) groups.push(s.group); });
    var box = $("siteList"); box.innerHTML = "";
    groups.forEach(function (g) {
      var items = S.config.sites.filter(function (s) {
        return s.group === g && (!q || (s.name + " " + s.slug + " " + s.folder + " " + s.subdomain).toLowerCase().indexOf(q) >= 0);
      });
      if (!items.length) return;
      var collapsed = sessionStorage.getItem("mk-col-" + g) === "1";
      var list = h("div", { class: collapsed ? "hidden" : "" }, items.map(function (s) {
        return h("button", { class: "site-item" + (s.id === S.cur ? " on" : ""), onclick: function () { openSite(s.id); } },
          h("span", { class: "dot " + (s.enabled ? "ok" : "off"), title: s.enabled ? "Online" : "Kikapcsolva" }),
          h("span", { class: "t" }, h("b", { text: s.name }), h("small", { text: s.folder ? "/" + s.slug + (s.subdomain ? " · " + s.subdomain + "." : "") : "Főoldal" })),
          siteChanged(s) ? h("span", { class: "chg", title: "Nem közzétett változás" }) : null);
      }));
      box.append(h("div", { class: "grp" },
        h("h3", { onclick: function () { sessionStorage.setItem("mk-col-" + g, collapsed ? "0" : "1"); renderSide(); } },
          h("span", { text: g + " (" + items.length + ")" }), h("span", { text: collapsed ? "▸" : "▾" })),
        list));
    });
    var nw = $("newWorks"); nw.innerHTML = "";
    S.discovered.filter(function (f) { return !S.config.sites.some(function (s) { return s.folder === f; }); }).forEach(function (f) {
      nw.append(h("div", { class: "newwork" },
        h("span", null, "Új munka a mappában: ", h("b", { text: f.split("/").pop() })),
        h("button", { class: "btn sm", onclick: function () { addWork(f); }, text: "Felvétel az adminba" })));
    });
  }
  $("q").addEventListener("input", renderSide);

  function addWork(folder) {
    var name = folder.split("/").pop(), base = slugify(name), slug = base, i = 2;
    var used = function (x) { return S.config.sites.some(function (s) { return s.slug === x || (s.aliases || []).indexOf(x) >= 0 || s.id === x; }) || RESERVED.indexOf(x) >= 0; };
    while (used(slug)) slug = base + "-" + i++;
    S.config.sites.push({ id: slug, name: name, group: "Kunden", folder: folder, slug: slug, subdomain: "", enabled: false, aliases: [], notes: "" });
    changed(); openSite(slug); setTab("settings");
    toast("Felvéve – kikapcsolt állapotban. Nézd át, aztán kapcsold be és tedd közzé.");
  }

  // ------------------------------------------------------------ Seite öffnen
  function openSite(id, force) {
    if (S.cur !== id) S.sel = null;
    S.cur = id;
    history.replaceState(null, "", "#site=" + id);
    renderSide(); renderHead();
    var p = S.pages[id];
    if (p && p.doc && !force) { renderTab(); renderPreview(); return; }
    $("blocks").innerHTML = ""; $("insp").innerHTML = "";
    $("blocks").append(h("li", { class: "empty" }, h("div", { class: "spin", style: "margin:0 auto" })));
    var site = siteById(id);
    var q = site && baseSite(id) ? "id=" + encodeURIComponent(id) : "folder=" + encodeURIComponent(site.folder);
    api("source?" + q).then(function (j) {
      var p = S.pages[id] = { id: id, htmlSha: j.htmlSha, overridesSha: j.overridesSha, uploads: [] };
      p.doctype = (j.html.match(/^\s*<!doctype[^>]*>/i) || ["<!doctype html>"])[0].trim();
      p.doc = new DOMParser().parseFromString(j.html, "text/html");
      p.base = serialize(p);
      p.overrides = j.overrides || {};
      p.overridesBase = JSON.stringify(p.overrides);
      var dp = S.draftPages && S.draftPages[id];
      if (dp) {
        p.doc = new DOMParser().parseFromString(dp.html, "text/html");
        p.overrides = dp.overrides || {};
        delete S.draftPages[id];
      }
      if (S.cur === id) { renderTab(); renderPreview(); renderSide(); updateSaveBar(); }
    }).catch(function (e) { toast(e.message, true); });
  }

  function renderHead() {
    var s = siteById(S.cur);
    if (!s) return;
    $("edTitle").innerHTML = "";
    $("edTitle").append(h("span", { text: s.name }), h("span", { class: "pill " + (s.enabled ? "ok" : "off"), text: s.enabled ? "Online" : "Kikapcsolva" }));
    var u = $("edUrl"); u.innerHTML = "";
    var b = baseSite(s.id);
    if (b) {
      u.append(h("a", { href: siteUrl(b), target: "_blank", rel: "noopener", text: siteUrl(b).replace("https://", "") + " ↗" }));
      if (b.subdomain) u.append(h("a", { href: "https://" + b.subdomain + "." + ROOT_DOMAIN + "/", target: "_blank", rel: "noopener", text: b.subdomain + "." + ROOT_DOMAIN + " ↗" }));
    } else u.append(h("span", { class: "muted", text: "Még nincs közzétéve" }));
  }

  function setTab(t) {
    S.tab = t;
    Array.prototype.forEach.call($("tabs").children, function (b) { b.classList.toggle("on", b.dataset.tab === t); });
    renderTab();
  }
  $("tabs").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setTab(b.dataset.tab); });

  function renderTab() {
    $("tabBlocks").classList.toggle("hidden", S.tab !== "blocks");
    $("tabSettings").classList.toggle("hidden", S.tab !== "settings");
    $("tabHistory").classList.toggle("hidden", S.tab !== "history");
    if (S.tab === "blocks") { renderInspector(); renderBlocks(); }
    if (S.tab === "settings") renderSettings();
    if (S.tab === "history") renderHistory();
  }

  // ------------------------------------------------------------ HTML-Modell
  function serialize(p) { return p.doctype + "\n" + p.doc.documentElement.outerHTML + "\n"; }
  function pageDirty(p) { return !!p.doc && (serialize(p) !== p.base || JSON.stringify(p.overrides) !== p.overridesBase || p.uploads.length > 0); }
  function curPage() { return S.pages[S.cur]; }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, NOSCRIPT: 1, LINK: 1, META: 1, svg: 1, SVG: 1 };
  function blockList(doc) {
    var out = [];
    Array.prototype.forEach.call(doc.body.children, function (el) {
      if (SKIP[el.tagName]) return;
      if (el.tagName === "MAIN") {
        Array.prototype.forEach.call(el.children, function (c) { if (!SKIP[c.tagName]) out.push({ el: c, movable: true }); });
      } else out.push({ el: el, movable: false });
    });
    return out;
  }
  function blockName(el) {
    var cl = el.classList, id = el.id;
    if (el.tagName === "HEADER") return ["Navigáció / fejléc", "header"];
    if (el.tagName === "FOOTER") return ["Lábléc", "footer"];
    if (cl.contains("mobile-bar")) return ["Mobil alsó gombsor", ".mobile-bar"];
    if (cl.contains("ld")) return ["Betöltő animáció", ".ld"];
    if (cl.contains("progress")) return ["Görgetési csík", ".progress"];
    if (cl.contains("lb") || el.getAttribute("role") === "dialog") return ["Képnagyító (lightbox)", "#" + (id || "lb")];
    if (cl.contains("hero")) return ["Hero (nyitó rész)", ".hero"];
    var t = el.querySelector("h1,h2,h3");
    var txt = t ? t.textContent.replace(/\s+/g, " ").trim() : "";
    if (txt.length > 48) txt = txt.slice(0, 46) + "…";
    return [txt || (id ? "#" + id : el.tagName.toLowerCase()), id ? "#" + id : el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "")];
  }

  function updateMkStyle(doc) {
    var ids = [];
    Array.prototype.forEach.call(doc.querySelectorAll("[data-mk-off][id]"), function (el) { if (/^[\w-]+$/.test(el.id)) ids.push(el.id); });
    var any = doc.querySelector("[data-mk-off]");
    var css = any ? "[data-mk-off]{display:none!important}" + (ids.length ? ids.map(function (i) { return "header a[href=\"#" + i + "\"],footer a[href=\"#" + i + "\"],nav a[href=\"#" + i + "\"]"; }).join(",") + "{display:none!important}" : "") : "";
    var st = doc.getElementById("mk-admin-style");
    if (!css) { if (st) st.remove(); return ""; }
    if (!st) { st = doc.createElement("style"); st.id = "mk-admin-style"; doc.head.appendChild(st); }
    st.textContent = css;
    return css;
  }

  // ------------------------------------------------------------ Vorschau
  var frame = $("frame");
  function overridesJs(o) {
    return "(function(o){var I=window.I18N=window.I18N||{};for(var l in o){I[l]=Object.assign(I[l]||{},o[l]);}})(" + JSON.stringify(o).replace(/</g, "\\u003c") + ");";
  }
  function ensureOverridesTag(doc) {
    if (doc.querySelector('script[src="mk-i18n.js"]')) return;
    var i18n = Array.prototype.find.call(doc.querySelectorAll("script[src]"), function (s) { return /(^|\/)i18n\.js$/.test(s.getAttribute("src")); });
    if (!i18n) return;
    var s = doc.createElement("script");
    s.setAttribute("src", "mk-i18n.js");
    if (i18n.hasAttribute("defer")) s.setAttribute("defer", "");
    i18n.after(s);
    i18n.after(doc.createTextNode("\n"));
  }

  function renderPreview(keepScroll) {
    var p = curPage(), site = siteById(S.cur);
    if (!p || !p.doc) return;
    var y = 0;
    try { if (keepScroll !== false) y = frame.contentWindow.scrollY || 0; } catch (e) {}
    var c = p.doc.cloneNode(true);
    var a = p.doc.getElementsByTagName("*"), b = c.getElementsByTagName("*");
    p.idx = new Map(); p.els = [];
    for (var i = 0; i < a.length; i++) { b[i].setAttribute("data-mk", i); p.idx.set(a[i], i); p.els[i] = a[i]; }
    var baseHref = site.folder ? "/" + encPath(site.folder) + "/" : "/";
    var base = c.createElement("base");
    base.setAttribute("href", baseHref);
    c.head.insertBefore(base, c.head.firstChild);
    var ov = c.querySelector('script[src="mk-i18n.js"]');
    if (ov) ov.setAttribute("src", "data:text/javascript;charset=utf-8," + encodeURIComponent(overridesJs(p.overrides)));
    // Relative Pfade direkt absolut machen (der Preload-Scanner ignoriert <base> in srcdoc)
    var abs = function (u) { return /^([a-z][a-z0-9+.-]*:|\/|#|data:)/i.test(u) ? u : baseHref + u; };
    Array.prototype.forEach.call(c.querySelectorAll("[src],link[href],[srcset],[imagesrcset]"), function (x) {
      if (x.hasAttribute("src")) x.setAttribute("src", abs(x.getAttribute("src")));
      if (x.tagName === "LINK") x.setAttribute("href", abs(x.getAttribute("href")));
      ["srcset", "imagesrcset"].forEach(function (at) {
        if (x.hasAttribute(at)) x.setAttribute(at, x.getAttribute(at).split(",").map(function (part) { var t = part.trim(); return t ? abs(t) : t; }).join(", "));
      });
    });
    // Neue Bilder sind erst nach dem Deploy online – bis dahin aus dem Speicher zeigen.
    var pend = S.pendingImgs[S.cur] || {};
    p.uploads.forEach(function (u) { pend[u.path] = u.dataUrl; });
    Array.prototype.forEach.call(c.querySelectorAll("img[src]"), function (img) { var u = pend[img.getAttribute("src").replace(baseHref, "")]; if (u) img.setAttribute("src", u); });
    frame.onload = function () { wireFrame(y); };
    frame.srcdoc = "<!doctype html>\n" + c.documentElement.outerHTML;
    $("unpubFlag").classList.toggle("hidden", !pageDirty(p));
  }

  function fdoc() { try { return frame.contentDocument; } catch (e) { return null; } }
  function live(el) {
    var p = curPage(), d = fdoc();
    if (!p || !d || !p.idx || !p.idx.has(el)) return null;
    return d.querySelector('[data-mk="' + p.idx.get(el) + '"]');
  }

  var hoverEl = null;
  function wireFrame(y) {
    var d = fdoc();
    if (!d) return;
    var st = d.createElement("style");
    st.id = "mk-edit-style";
    st.textContent = ".mk-hover{outline:2px dashed #2f6bff!important;outline-offset:2px!important;cursor:pointer!important}.mk-sel{outline:3px solid #ff5a36!important;outline-offset:2px!important}";
    d.head.appendChild(st);
    if (y) setTimeout(function () { try { frame.contentWindow.scrollTo(0, y); } catch (e) {} }, 60);
    d.addEventListener("mouseover", function (e) {
      if (!S.editMode) return;
      var t = e.target.closest && e.target.closest("[data-mk]");
      if (hoverEl && hoverEl !== t) hoverEl.classList.remove("mk-hover");
      hoverEl = t;
      if (t && t.tagName !== "BODY" && t.tagName !== "HTML") t.classList.add("mk-hover");
    }, true);
    d.addEventListener("mouseout", function () { if (hoverEl) hoverEl.classList.remove("mk-hover"); }, true);
    d.addEventListener("click", function (e) {
      if (!S.editMode) return;
      var t = pickTarget(d, e);
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      var el = curPage().els[Number(t.getAttribute("data-mk"))];
      if (el && el.tagName !== "BODY" && el.tagName !== "HTML") select(el);
    }, true);
    d.addEventListener("submit", function (e) { e.preventDefault(); }, true);
    markSel();
  }
  // Liegt über einem Bild/Text eine Deko-Ebene, wird trotzdem das Bild bzw. der Text gewählt.
  function pickTarget(d, e) {
    var top = e.target.closest && e.target.closest("[data-mk]");
    if (!top) return null;
    var p = curPage(), topEl = p.els[Number(top.getAttribute("data-mk"))];
    if (topEl && (topEl.tagName === "IMG" || topEl.tagName === "A" || topEl.getAttribute("data-i18n") || topEl.getAttribute("data-i18n-html") || isTexty(topEl))) return top;
    var stack = d.elementsFromPoint(e.clientX, e.clientY);
    for (var i = 0; i < stack.length; i++) {
      var x = stack[i];
      if (!x.hasAttribute || !x.hasAttribute("data-mk")) continue;
      var src = p.els[Number(x.getAttribute("data-mk"))];
      if (src && (src.tagName === "IMG" || isTexty(src))) return x;
    }
    return top;
  }
  function markSel() {
    var d = fdoc(); if (!d) return;
    Array.prototype.forEach.call(d.querySelectorAll(".mk-sel"), function (x) { x.classList.remove("mk-sel"); });
    if (S.sel) { var l = live(S.sel); if (l) l.classList.add("mk-sel"); }
  }
  function select(el) {
    S.sel = el;
    if (S.tab !== "blocks") setTab("blocks"); else renderInspector();
    markSel();
    $("insp").scrollIntoView({ block: "nearest" });
  }
  function scrollToLive(el) {
    var l = live(el);
    if (l) l.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("devSeg").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    S.device = b.dataset.dev;
    Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); });
    $("frameWrap").className = "frame-wrap " + S.device;
  });
  $("editMode").addEventListener("change", function () {
    S.editMode = this.checked;
    if (!S.editMode && hoverEl) hoverEl.classList.remove("mk-hover");
  });
  $("btnReload").onclick = function () { renderPreview(); };

  // ------------------------------------------------------------ Änderungen
  function changed(opts) {
    opts = opts || {};
    if (opts.preview) renderPreview();
    if (opts.style) {
      var css = updateMkStyle(curPage().doc), d = fdoc();
      if (d) {
        var st = d.getElementById("mk-admin-style");
        if (!st && css) { st = d.createElement("style"); st.id = "mk-admin-style"; d.head.appendChild(st); }
        if (st) st.textContent = css;
      }
    }
    var p = curPage();
    if (p) $("unpubFlag").classList.toggle("hidden", !pageDirty(p));
    renderSide(); renderHead(); updateSaveBar(); saveDraftSoon();
  }

  function toggleOff(el) {
    var off = !el.hasAttribute("data-mk-off");
    if (off) el.setAttribute("data-mk-off", ""); else el.removeAttribute("data-mk-off");
    var l = live(el);
    if (l) { if (off) l.setAttribute("data-mk-off", ""); else l.removeAttribute("data-mk-off"); }
    changed({ style: true });
    renderBlocks(); renderInspector();
  }

  // Kommentar direkt vor einer Sektion (z. B. <!-- ===== FAQ ===== -->) gehört zu ihr.
  function leadComment(el) {
    var n = el.previousSibling;
    while (n && n.nodeType === 3 && !n.nodeValue.trim()) n = n.previousSibling;
    return n && n.nodeType === 8 ? n : null;
  }
  function moveBlock(el, before) {
    if (before === el) return;
    var parent = el.parentNode, com = leadComment(el), anchor = before ? (leadComment(before) || before) : null;
    if (com) { parent.insertBefore(com, anchor); parent.insertBefore(el.ownerDocument.createTextNode("\n  "), anchor); }
    parent.insertBefore(el, anchor);
    parent.insertBefore(el.ownerDocument.createTextNode("\n\n  "), anchor);
    var l = live(el), lb = before ? live(before) : null;
    if (l && (lb || !before)) { l.parentNode.insertBefore(l, lb); changed(); }
    else changed({ preview: true });
    renderBlocks();
  }

  // ------------------------------------------------------------ Blöcke
  function renderBlocks() {
    var p = curPage(), ul = $("blocks");
    ul.innerHTML = "";
    if (!p || !p.doc) return;
    var list = blockList(p.doc);
    var movables = list.filter(function (b) { return b.movable; }).map(function (b) { return b.el; });
    list.forEach(function (b) {
      var nm = blockName(b.el), off = b.el.hasAttribute("data-mk-off");
      var li = h("li", { class: "blk" + (off ? " off" : ""), draggable: b.movable ? "true" : null },
        h("span", { class: "grip" + (b.movable ? "" : " fixed"), title: b.movable ? "Húzd a sorrendhez" : "Fix helyen" }, b.movable ? "⋮⋮" : "•"),
        h("span", { class: "blk-name", onclick: function () { select(b.el); scrollToLive(b.el); } }, h("b", { text: nm[0] }), h("small", { text: nm[1] })),
        h("span", { class: "acts" },
          b.movable ? h("button", { class: "btn icon sm ghost", title: "Feljebb", "aria-label": "Feljebb", onclick: function () { var i = movables.indexOf(b.el); if (i > 0) moveBlock(b.el, movables[i - 1]); } }, "↑") : null,
          b.movable ? h("button", { class: "btn icon sm ghost", title: "Lejjebb", "aria-label": "Lejjebb", onclick: function () { var i = movables.indexOf(b.el); if (i < movables.length - 1) moveBlock(b.el, nextAfter(movables[i + 1])); } }, "↓") : null,
          h("button", { class: "btn icon sm ghost", title: off ? "Megjelenítés" : "Elrejtés", "aria-label": off ? "Megjelenítés" : "Elrejtés", onclick: function () { toggleOff(b.el); } }, off ? "◌" : "👁")));
      if (b.movable) {
        li.addEventListener("dragstart", function (e) { S.drag = b.el; li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "x"); });
        li.addEventListener("dragend", function () { S.drag = null; li.classList.remove("dragging"); clearDrop(); });
        li.addEventListener("dragover", function (e) {
          if (!S.drag || S.drag === b.el) return;
          e.preventDefault(); clearDrop();
          var r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
          li.classList.add(after ? "drop-after" : "drop-before"); li._after = after;
        });
        li.addEventListener("drop", function (e) {
          e.preventDefault();
          if (!S.drag || S.drag === b.el) return;
          var target = li._after ? nextAfter(b.el) : b.el;
          moveBlock(S.drag, target);
        });
      }
      ul.append(li);
    });

    // Ausgeblendete Einzelelemente (nicht Sektionen)
    var he = $("hiddenEls"); he.innerHTML = "";
    var blockEls = list.map(function (b) { return b.el; });
    var hid = Array.prototype.filter.call(p.doc.querySelectorAll("[data-mk-off]"), function (x) { return blockEls.indexOf(x) < 0; });
    if (hid.length) {
      he.append(h("div", { class: "sec-title", text: "Elrejtett elemek" }));
      he.append(h("ul", { class: "blocks" }, hid.map(function (x) {
        var t = x.textContent.replace(/\s+/g, " ").trim().slice(0, 50) || (x.tagName === "IMG" ? "Kép: " + (x.getAttribute("alt") || x.getAttribute("src")) : x.tagName.toLowerCase());
        return h("li", { class: "blk off" }, h("span", { class: "blk-name", onclick: function () { select(x); } }, h("b", { text: t }), h("small", { text: x.tagName.toLowerCase() })),
          h("button", { class: "btn sm", onclick: function () { toggleOff(x); }, text: "Megjelenítés" }));
      })));
    }
  }
  function nextAfter(el) { var n = el.nextElementSibling; return n; }
  function clearDrop() { Array.prototype.forEach.call(document.querySelectorAll(".drop-before,.drop-after"), function (x) { x.classList.remove("drop-before", "drop-after"); }); }

  // ------------------------------------------------------------ Inspektor
  function isTexty(el) {
    if (/^(SCRIPT|STYLE|IMG|svg|SVG|INPUT|SELECT|TEXTAREA|IFRAME|VIDEO)$/.test(el.tagName)) return false;
    if (!el.textContent.trim()) return false;
    return Array.prototype.every.call(el.querySelectorAll("*"), function (c) { return INLINE[c.tagName]; });
  }
  function frameI18N() { try { return frame.contentWindow.I18N || null; } catch (e) { return null; } }
  function frameLang() { var d = fdoc(); return d ? (d.documentElement.lang || "de").slice(0, 2) : "de"; }

  function field(label, input, hint) { return h("label", { class: "f" }, h("span", null, label), input, hint ? h("span", { class: "hint", text: hint }) : null); }

  function renderInspector() {
    var box = $("insp"); box.innerHTML = "";
    var el = S.sel, p = curPage();
    if (!el || !p || !p.doc.contains(el)) { S.sel = null; return; }
    var desc = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList.length ? "." + Array.prototype.slice.call(el.classList, 0, 2).join(".") : "");
    var parent = el.parentElement && !/^(BODY|HTML)$/.test(el.parentElement.tagName) ? el.parentElement : null;
    var off = el.hasAttribute("data-mk-off");
    var wrap = h("div", { class: "insp" },
      h("div", { class: "crumb" }, h("code", { text: desc }),
        parent ? h("button", { class: "btn sm ghost", onclick: function () { select(parent); }, text: "↖ Szülő elem" }) : null,
        h("button", { class: "btn sm ghost", onclick: function () { scrollToLive(el); }, text: "Mutasd" }),
        h("button", { class: "btn sm ghost", onclick: function () { toggleOff(el); }, text: off ? "Megjelenítés" : "Elrejtés" }),
        h("span", { style: "flex:1" }),
        h("button", { class: "btn sm icon ghost", "aria-label": "Bezárás", onclick: function () { S.sel = null; markSel(); renderInspector(); } }, "✕")));

    var key = el.getAttribute("data-i18n") || el.getAttribute("data-i18n-html");
    if (key) {
      var I = frameI18N() || {};
      var langs = ["de"];
      Object.keys(I).concat(Object.keys(p.overrides)).forEach(function (l) { if (langs.indexOf(l) < 0) langs.push(l); });
      wrap.append(h("p", { class: "hint", style: "margin:0 0 10px" }, "Többnyelvű szöveg (", h("code", { text: key }), "). Minden nyelvet itt tudsz átírni."));
      langs.forEach(function (l) {
        var cur = p.overrides[l] && p.overrides[l][key] != null ? p.overrides[l][key]
          : l === "de" ? ((I.de && I.de[key] != null) ? I.de[key] : el.innerHTML.trim())
          : (I[l] && I[l][key] != null ? I[l][key] : "");
        var ta = h("textarea", { class: "inp", rows: Math.min(6, Math.max(2, Math.ceil(String(cur).length / 42))) });
        ta.value = toEditable(cur);
        ta.addEventListener("input", function () { setI18n(el, key, l, fromEditable(ta.value)); });
        wrap.append(h("label", { class: "f" }, h("span", null, h("span", { class: "lang-tag", text: l.toUpperCase() }), l === "de" ? "Német (alap)" : ""), ta));
      });
    } else if (isTexty(el)) {
      var hasTags = el.children.length > 0;
      var ta = h("textarea", { class: "inp", rows: 3 });
      ta.value = hasTags ? toEditable(el.innerHTML.trim()) : el.textContent.trim();
      ta.addEventListener("input", function () {
        var v = hasTags ? fromEditable(ta.value) : ta.value;
        if (hasTags) el.innerHTML = v; else el.textContent = v;
        var l = live(el);
        if (l) { if (hasTags) l.innerHTML = v; else l.textContent = v; }
        changed();
      });
      wrap.append(field("Szöveg" + (hasTags ? " (HTML: <b>, <br> stb. megengedett)" : ""), ta));
    } else if (el.tagName !== "IMG" && el.tagName !== "A") {
      wrap.append(h("p", { class: "hint", style: "margin:0" }, "Ez egy tároló elem. Kattints az előnézetben egy konkrét szövegre, képre vagy linkre a szerkesztéshez."));
    }

    var a = el.tagName === "A" ? el : null;
    if (a) {
      var href = h("input", { class: "inp", value: a.getAttribute("href") || "" });
      href.addEventListener("input", function () { setAttr(a, "href", href.value); });
      var nt = h("input", { type: "checkbox" }); nt.checked = a.getAttribute("target") === "_blank";
      nt.addEventListener("change", function () {
        setAttr(a, "target", nt.checked ? "_blank" : null);
        setAttr(a, "rel", nt.checked ? "noopener" : null);
      });
      wrap.append(field("Link címe", href, "pl. https://…, tel:+43…, mailto:…, #szekcio"),
        h("label", { class: "switch small", style: "margin-bottom:12px" }, nt, h("span", { class: "tr" }), "Új lapon nyíljon"));
      if (!key && !isTexty(a) && a.textContent.trim() === "") wrap.append(h("p", { class: "hint", text: "A link szövegét a benne lévő elemre kattintva szerkesztheted." }));
    }

    if (el.tagName === "IMG") {
      var l = live(el);
      wrap.append(h("img", { class: "thumb", src: l ? (l.currentSrc || l.src) : "", alt: "" }));
      var fi = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif" });
      fi.addEventListener("change", function () { if (fi.files[0]) replaceImage(el, fi.files[0]); });
      var alt = h("input", { class: "inp", value: el.getAttribute("alt") || "" });
      alt.addEventListener("input", function () { setAttr(el, "alt", alt.value); });
      wrap.append(field("Kép cseréje", fi, "JPG/PNG/WebP. A nagy képeket automatikusan kicsinyítjük."), field("Alternatív szöveg (alt)", alt, "Google és képernyőolvasók számára."));
    }
    box.append(wrap);
  }

  function setAttr(el, name, val) {
    var l = live(el);
    [el, l].forEach(function (x) { if (!x) return; if (val == null) x.removeAttribute(name); else x.setAttribute(name, val); });
    changed();
  }
  function setI18n(el, key, lang, val) {
    var p = curPage();
    (p.overrides[lang] = p.overrides[lang] || {})[key] = val;
    if (lang === "de") el.innerHTML = val;
    var I = frameI18N();
    if (I) (I[lang] = I[lang] || {})[key] = val;
    if (frameLang() === lang) { var l = live(el); if (l) l.innerHTML = val; }
    ensureOverridesTag(p.doc);
    changed();
  }

  function replaceImage(el, file) {
    var p = curPage();
    readImage(file).then(function (r) {
      var name = "img/up-" + Date.now().toString(36) + "-" + slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 30) + "." + r.ext;
      p.uploads.push({ path: name, data: r.dataUrl.split(",")[1], dataUrl: r.dataUrl });
      el.setAttribute("src", name); el.removeAttribute("srcset"); el.removeAttribute("sizes");
      var l = live(el);
      if (l) { l.removeAttribute("srcset"); l.removeAttribute("sizes"); l.setAttribute("src", r.dataUrl); }
      changed(); renderInspector();
    }).catch(function (e) { toast(e.message, true); });
  }
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return reject(new Error("Csak JPG, PNG, WebP vagy GIF tölthető fel."));
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error("A fájl nem olvasható.")); };
      fr.onload = function () {
        var url = fr.result;
        var img = new Image();
        img.onload = function () {
          var max = 2000, w = img.naturalWidth, hh = img.naturalHeight;
          if (file.type === "image/gif" || (w <= max && hh <= max && file.size < 1.5e6)) {
            if (file.size > 3e6) return reject(new Error("A kép túl nagy (max. 3 MB)."));
            return resolve({ dataUrl: url, ext: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type] });
          }
          var sc = Math.min(1, max / Math.max(w, hh)), cv = document.createElement("canvas");
          cv.width = Math.round(w * sc); cv.height = Math.round(hh * sc);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          var png = file.type === "image/png" && w * hh < 1.5e6;
          resolve({ dataUrl: cv.toDataURL(png ? "image/png" : "image/jpeg", 0.85), ext: png ? "png" : "jpg" });
        };
        img.onerror = function () { reject(new Error("A kép nem olvasható.")); };
        img.src = url;
      };
      fr.readAsDataURL(file);
    });
  }

  // ------------------------------------------------------------ Einstellungen
  function validateSite(s) {
    var errs = {};
    if (!s.folder) return errs;
    if (!NAME_RE.test(s.slug)) errs.slug = "Csak kisbetű, szám és kötőjel (a–z, 0–9, -).";
    else if (RESERVED.indexOf(s.slug) >= 0) errs.slug = "Ez a cím foglalt.";
    else S.config.sites.forEach(function (o) {
      if (o.id !== s.id && (o.slug === s.slug || (o.aliases || []).indexOf(s.slug) >= 0)) errs.slug = "Már használja: " + o.name;
    });
    if (s.subdomain) {
      if (!NAME_RE.test(s.subdomain) || s.subdomain === "www") errs.subdomain = "Csak kisbetű, szám és kötőjel.";
      else S.config.sites.forEach(function (o) { if (o.id !== s.id && o.subdomain === s.subdomain) errs.subdomain = "Már használja: " + o.name; });
    }
    return errs;
  }
  function allValid() { return S.config.sites.every(function (s) { return !Object.keys(validateSite(s)).length; }); }

  function renderSettings() {
    var box = $("tabSettings"); box.innerHTML = "";
    var s = siteById(S.cur); if (!s) return;
    var b = baseSite(s.id), isMain = !s.folder;
    var errs = validateSite(s);

    function inp(key, attrs) {
      var i = h("input", Object.assign({ class: "inp" + (errs[key] ? " err" : ""), value: s[key] || "" }, attrs || {}));
      i.addEventListener("input", function () {
        s[key] = attrs && attrs.lower ? i.value.toLowerCase().trim() : i.value;
        changed(); var e2 = validateSite(s);
        i.classList.toggle("err", !!e2[key]);
        var et = box.querySelector('[data-err="' + key + '"]'); if (et) et.textContent = e2[key] || "";
        renderSide(); renderHead();
      });
      return i;
    }

    var en = h("input", { type: "checkbox" }); en.checked = !!s.enabled; en.disabled = isMain;
    en.addEventListener("change", function () { s.enabled = en.checked; changed(); renderSettings(); });
    box.append(h("div", { class: "insp", style: "display:flex;align-items:center;justify-content:space-between;gap:10px" },
      h("div", null, h("b", { text: s.enabled ? "Az oldal online" : "Az oldal ki van kapcsolva" }), h("div", { class: "hint", text: isMain ? "A főoldal mindig online." : s.enabled ? "Bárki elérheti a címén." : "A látogatók egy „nem elérhető” oldalt látnak. Az NFC-kártya linkje nem változik." })),
      h("label", { class: "switch" }, en, h("span", { class: "tr" }))));

    box.append(field("Név (csak az adminban látszik)", inp("name")));
    var groups = (S.config.groups || []).slice();
    S.config.sites.forEach(function (x) { if (groups.indexOf(x.group) < 0) groups.push(x.group); });
    var gi = inp("group", { list: "grpList" });
    box.append(h("datalist", { id: "grpList" }, groups.map(function (g) { return h("option", { value: g }); })));
    box.append(field("Csoport", gi, "Válassz a listából, vagy írj be egy új csoportnevet."));

    if (!isMain) {
      box.append(h("div", { class: "sec-title", text: "Cím" }));
      box.append(h("label", { class: "f" }, h("span", null, "Cím a meinekontaktkarte.com alatt"),
        h("div", { class: "affix" }, h("span", { class: "fx", text: ROOT_DOMAIN + "/" }), inp("slug", { lower: true, spellcheck: "false", autocapitalize: "off" }), h("span", { class: "fx", text: "/" })),
        h("span", { class: "err-text", "data-err": "slug", text: errs.slug || "" })));
      if (b && b.slug && b.slug !== s.slug) {
        box.append(h("p", { class: "hint", style: "margin:-6px 0 14px;color:var(--ok)" }, "✓ A régi cím (/" + b.slug + ") közzététel után automatikusan átirányít ide, így a már kiadott NFC-kártyák is működnek."));
      }
      box.append(h("label", { class: "f" }, h("span", null, "Aldomain (opcionális)"),
        h("div", { class: "affix" }, inp("subdomain", { lower: true, spellcheck: "false", autocapitalize: "off", placeholder: "pl. caribik" }), h("span", { class: "fx", text: "." + ROOT_DOMAIN })),
        h("span", { class: "err-text", "data-err": "subdomain", text: errs.subdomain || "" }),
        h("span", { class: "hint", text: "Egyszeri beállítás kell hozzá a Vercelben (*." + ROOT_DOMAIN + " wildcard domain), lásd ADMIN.md." })));

      if ((s.aliases || []).length) {
        box.append(h("div", { class: "sec-title", text: "Régi címek (átirányítanak ide)" }));
        box.append(h("ul", { class: "hist" }, s.aliases.map(function (al) {
          return h("li", null, h("span", { class: "t" }, h("b", { text: ROOT_DOMAIN + "/" + al })),
            h("button", { class: "btn sm danger", text: "Törlés", onclick: function () {
              ask("Átirányítás törlése?", "Ha van kint NFC-kártya ezzel a címmel (/" + al + "), az utána nem fog működni.", "Törlés", true).then(function (y) {
                if (!y) return; s.aliases = s.aliases.filter(function (x) { return x !== al; }); changed(); renderSettings();
              });
            } }));
        })));
      }
      box.append(h("p", { class: "hint", style: "margin-top:14px" }, "Mappa a repóban: ", h("code", { text: s.folder })));
    }

    var notes = h("textarea", { class: "inp", rows: 4 }); notes.value = s.notes || "";
    notes.addEventListener("input", function () { s.notes = notes.value; changed(); });
    box.append(h("div", { class: "sec-title", text: "Jegyzet" }), field("Belső jegyzet (ügyfél, határidő, számla …)", notes));

    if (!b) {
      box.append(h("button", { class: "btn danger sm", text: "Felvétel visszavonása", onclick: function () {
        S.config.sites = S.config.sites.filter(function (x) { return x.id !== s.id; });
        delete S.pages[s.id]; changed(); openSite(S.config.sites[0].id);
      } }));
    }
  }

  // ------------------------------------------------------------ Verlauf
  function renderHistory() {
    var box = $("tabHistory"); box.innerHTML = "";
    var s = siteById(S.cur);
    if (!baseSite(s.id)) { box.append(h("p", { class: "empty", text: "Közzététel után itt jelennek meg a verziók." })); return; }
    var mode = S.histMode || "page";
    box.append(h("div", { class: "seg", style: "margin-bottom:12px" },
      h("button", { class: mode === "page" ? "on" : "", text: "Ennek az oldalnak a tartalma", onclick: function () { S.histMode = "page"; renderHistory(); } }),
      h("button", { class: mode === "config" ? "on" : "", text: "Címek & be/ki (összes)", onclick: function () { S.histMode = "config"; renderHistory(); } })));
    box.append(h("p", { class: "hint", text: "Minden közzététel egy mentett verzió. A visszaállítás is új verzióként kerül be, így semmi nem vész el." }));
    var ul = h("ul", { class: "hist" }, h("li", null, h("div", { class: "spin" })));
    box.append(ul);
    api("history" + (mode === "page" ? "?id=" + encodeURIComponent(s.id) : "")).then(function (j) {
      ul.innerHTML = "";
      if (!j.commits.length) ul.append(h("li", { class: "muted", text: "Még nincs korábbi verzió." }));
      j.commits.forEach(function (c, i) {
        ul.append(h("li", null,
          h("span", { class: "t" }, h("b", { text: c.message.replace(/^admin:\s*/, "") }), h("small", { text: fmtDate(c.date) + " · " + c.sha.slice(0, 7) + (i === 0 ? " · aktuális" : "") })),
          i === 0 ? null : h("button", { class: "btn sm", text: "Visszaállítás", onclick: function () { restore(mode === "page" ? s.id : null, c); } })));
      });
    }).catch(function (e) { ul.innerHTML = ""; ul.append(h("li", { class: "err-text", text: e.message })); });
  }

  function restore(id, c) {
    var dirty = anyDirty();
    ask("Visszaállítás erre a verzióra?", h("div", null,
      h("p", { class: "muted", text: "„" + c.message.replace(/^admin:\s*/, "") + "” – " + fmtDate(c.date) }),
      dirty ? h("p", { class: "err-text", text: "A még nem közzétett változtatásaid elvesznek." }) : null,
      h("p", { class: "hint", text: "Élesben kb. 1 perc múlva jelenik meg." })), "Visszaállítás").then(function (y) {
      if (!y) return;
      api("restore", { id: id, sha: c.sha }).then(function () {
        clearDraft(); S.pages = {};
        return loadSites().then(function () { openSite(S.cur, true); watchDeploy(); toast("Visszaállítva ✓"); });
      }).catch(function (e) { toast(e.message, true); });
    });
  }

  // ------------------------------------------------------------ Veröffentlichen
  function anyDirty() {
    if (JSON.stringify(S.config) !== S.configBase) return true;
    return Object.keys(S.pages).some(function (id) { return pageDirty(S.pages[id]); });
  }
  function describeChanges() {
    var out = [], base = JSON.parse(S.configBase);
    S.config.sites.forEach(function (s) {
      var b = base.sites.find(function (x) { return x.id === s.id; });
      if (!b) { out.push("Új munka: " + s.name); return; }
      if (b.enabled !== s.enabled) out.push(s.name + ": " + (s.enabled ? "bekapcsolva" : "kikapcsolva"));
      if (b.slug !== s.slug) out.push(s.name + ": cím /" + b.slug + " → /" + s.slug);
      if (b.subdomain !== s.subdomain) out.push(s.name + ": aldomain " + (s.subdomain ? s.subdomain + "." + ROOT_DOMAIN : "eltávolítva"));
      if (b.name !== s.name) out.push("Átnevezve: " + b.name + " → " + s.name);
      if (b.group !== s.group) out.push(s.name + ": csoport → " + s.group);
      if (b.notes !== s.notes) out.push(s.name + ": jegyzet");
      if (JSON.stringify(b.aliases) !== JSON.stringify(s.aliases)) out.push(s.name + ": régi címek");
    });
    base.sites.forEach(function (b) { if (!S.config.sites.some(function (s) { return s.id === b.id; })) out.push("Eltávolítva: " + b.name); });
    Object.keys(S.pages).forEach(function (id) {
      var p = S.pages[id]; if (!pageDirty(p)) return;
      var s = siteById(id), bits = [];
      if (serialize(p) !== p.base) bits.push("szekciók/tartalom");
      if (JSON.stringify(p.overrides) !== p.overridesBase) bits.push("fordítások");
      if (p.uploads.length) bits.push(p.uploads.length + " új kép");
      out.push((s ? s.name : id) + ": " + bits.join(", "));
    });
    return out;
  }
  function updateSaveBar() {
    var dirty = S.config && anyDirty();
    $("saveBar").classList.toggle("hidden", !dirty);
    if (!dirty) return;
    var n = describeChanges().length;
    $("saveInfo").textContent = n + " nem közzétett változás";
    $("btnPublish").disabled = !allValid();
    $("btnPublish").title = allValid() ? "" : "Javítsd a hibás mezőket a Beállításokban";
  }

  function configToSave() {
    var c = clone(S.config), base = JSON.parse(S.configBase);
    c.sites.forEach(function (s) {
      var b = base.sites.find(function (x) { return x.id === s.id; });
      s.aliases = (s.aliases || []).filter(function (a) { return a !== s.slug; });
      if (b && b.slug && b.slug !== s.slug && s.aliases.indexOf(b.slug) < 0) s.aliases.push(b.slug);
    });
    return c;
  }

  $("btnPublish").onclick = function () {
    var ch = describeChanges();
    ask("Közzététel", h("div", null, h("p", { class: "muted", text: "Ezek a változások kerülnek élesbe:" }), h("ul", null, ch.map(function (x) { return h("li", { text: x }); })),
      h("p", { class: "hint", text: "Élesben kb. 30–60 mp múlva látszik (Vercel deploy). Minden közzététel visszaállítható a Verziók fülön." })), "Közzététel").then(function (y) {
      if (!y) return;
      var pages = [];
      Object.keys(S.pages).forEach(function (id) {
        var p = S.pages[id]; if (!pageDirty(p)) return;
        var item = { id: id };
        if (serialize(p) !== p.base) { item.html = serialize(p); item.htmlSha = p.htmlSha; }
        if (JSON.stringify(p.overrides) !== p.overridesBase) { item.overrides = p.overrides; item.overridesSha = p.overridesSha; }
        if (p.uploads.length) item.uploads = p.uploads.map(function (u) { return { path: u.path, data: u.data }; });
        pages.push(item);
      });
      var summary = ch.slice(0, 4).join("; ") + (ch.length > 4 ? " (+" + (ch.length - 4) + ")" : "");
      $("btnPublish").disabled = true; $("btnPublish").textContent = "Mentés…";
      api("save", { configSha: S.configSha, config: configToSave(), pages: pages, summary: summary }).then(function (j) {
        clearDraft();
        Object.keys(S.pages).forEach(function (id) {
          S.pages[id].uploads.forEach(function (u) { (S.pendingImgs[id] = S.pendingImgs[id] || {})[u.path] = u.dataUrl; });
        });
        var keep = S.cur; S.pages = {};
        return loadSites().then(function () { openSite(keep, true); watchDeploy(j.rev); toast("Közzétéve ✓ – élesítés folyamatban"); });
      }).catch(function (e) {
        saveDraft();
        if (e.status === 409) {
          ask("Ütközés", e.message + " A piszkozatod el van mentve.", "Újratöltés").then(function (y2) { if (y2) location.reload(); });
        } else toast(e.message, true);
      }).finally(function () { $("btnPublish").disabled = false; $("btnPublish").textContent = "Közzététel"; updateSaveBar(); });
    });
  };

  $("btnDiscard").onclick = function () {
    ask("Minden változás elvetése?", "A még nem közzétett módosítások elvesznek.", "Elvetés", true).then(function (y) {
      if (!y) return;
      clearDraft(); S.config = JSON.parse(S.configBase); S.pages = {}; S.sel = null; S.draftPages = null;
      if (!siteById(S.cur)) S.cur = S.config.sites[0].id;
      openSite(S.cur, true); updateSaveBar();
    });
  };

  // Deploy beobachten: /data/sites.json vom Live-Deploy abfragen, bis die neue Rev da ist.
  function watchDeploy(rev) {
    rev = rev || (S.config && S.config.rev);
    var el = $("deploy"), t0 = Date.now();
    clearTimeout(S.deployT);
    el.innerHTML = ""; el.append(h("span", { class: "spin" }), h("span", { text: "Élesítés folyamatban…" }));
    (function poll() {
      fetch("/data/sites.json?t=" + Date.now(), { cache: "no-store", credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (j) {
        if (j && j.rev === rev) {
          el.innerHTML = ""; el.append(h("span", { class: "pill ok", text: "Élesben ✓ " + new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }) }));
          return;
        }
        if (Date.now() - t0 > 6 * 60 * 1000) { el.innerHTML = ""; el.append(h("span", { class: "pill warn", text: "A deploy még nem látszik – nézd meg a Vercelben" })); return; }
        S.deployT = setTimeout(poll, 4000);
      });
    })();
  }

  window.addEventListener("beforeunload", function (e) {
    if (S.config && anyDirty()) { saveDraft(); e.preventDefault(); e.returnValue = ""; }
  });

  boot();
})();
