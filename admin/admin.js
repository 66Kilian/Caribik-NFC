/* meinekontaktkarte.com – Admin
   Alles, was hier geändert wird, bleibt ein Entwurf (lokal gespeichert), bis
   „Közzététel“ gedrückt wird. Dann entsteht ein Git-Commit → Vercel deployt. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var ROOT_DOMAIN = "meinekontaktkarte.com";
  var RESERVED = ["admin", "api", "data", "lib", "img", "scripts", "munkak", "munkák", "favicon.ico", "favicon.svg", "robots.txt", "sitemap.xml", "i18n.js", "index.html", "www", "mail", "static", "assets", "_vercel", "404"];
  var NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
  var E = window.MKEdit; // gemeinsamer Editor-Kern (mk-edit.js)
  var DRAFT_KEY = "mk-admin-draft";
  var IDLE_MS = 30 * 60 * 1000;

  var S = {
    config: null, configBase: "", configSha: null, discovered: [],
    pages: {}, cur: null, tab: "blocks", device: "mobile", editMode: true, sel: null,
    deploy: null, draftOffer: null, pendingImgs: {}
  };

  // ------------------------------------------------------------ Hilfen
  var h = E.h;
  function show(id) { ["vBoot", "vSetup", "vLogin", "vApp"].forEach(function (v) { $(v).classList.toggle("hidden", v !== id); }); }
  function toast(msg, bad) {
    var t = h("div", { class: "toast" + (bad ? " bad" : ""), text: msg, role: "status" });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, bad ? 6000 : 2600);
  }
  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString("hu-HU", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso; } }
  var toEditable = E.toEditable, fromEditable = E.fromEditable;
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
      var p = S.pages[id] = E.loadPage(id, j);
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
  var serialize = E.serialize, pageDirty = E.pageDirty;
  function curPage() { return S.pages[S.cur]; }

  var blockList = E.blockList;
  var BLOCK_LABELS = { header: "Navigáció / fejléc", footer: "Lábléc", mobileBar: "Mobil alsó gombsor", loader: "Betöltő animáció", progress: "Görgetési csík", lightbox: "Képnagyító (lightbox)", hero: "Hero (nyitó rész)" };
  function blockName(el) { return E.blockName(el, BLOCK_LABELS); }

  var updateMkStyle = E.updateMkStyle;

  // ------------------------------------------------------------ Vorschau
  var frame = $("frame");
  var ensureOverridesTag = E.ensureOverridesTag;

  function renderPreview(keepScroll) {
    var p = curPage(), site = siteById(S.cur);
    if (!p || !p.doc) return;
    var y = 0;
    try { if (keepScroll !== false) y = frame.contentWindow.scrollY || 0; } catch (e) {}
    var baseHref = site.folder ? "/" + encPath(site.folder) + "/" : "/";
    var html = E.previewHtml(p, baseHref, S.pendingImgs[S.cur]);
    frame.onload = function () { wireFrame(y); };
    frame.srcdoc = html;
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
  function pickTarget(d, e) { return E.pickTarget(d, e, curPage()); }
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

  function moveBlock(el, before) {
    if (before === el) return;
    E.moveNode(el, before);
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
  var isTexty = E.isTexty;
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
    E.readImage(file, IMG_MSG).then(function (r) {
      var name = E.uploadName(file, r.ext);
      p.uploads.push({ path: name, data: r.dataUrl.split(",")[1], dataUrl: r.dataUrl });
      el.setAttribute("src", name); el.removeAttribute("srcset"); el.removeAttribute("sizes");
      var l = live(el);
      if (l) { l.removeAttribute("srcset"); l.removeAttribute("sizes"); l.setAttribute("src", r.dataUrl); }
      changed(); renderInspector();
    }).catch(function (e) { toast(e.message, true); });
  }
  var IMG_MSG = { type: "Csak JPG, PNG, WebP vagy GIF tölthető fel.", read: "A kép nem olvasható.", size: "A kép túl nagy (max. 3 MB)." };

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

      // Saját GitHub-repó (tükör)
      box.append(h("div", { class: "sec-title", text: "Saját GitHub-repó" }));
      var ri = h("input", { class: "inp", value: s.repo || "", placeholder: "66Kilian/LoveKinoADMIN", spellcheck: "false", autocapitalize: "off" });
      ri.addEventListener("input", function () { s.repo = ri.value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, ""); changed(); });
      box.append(field("Repó (tulajdonos/név)", ri, "Minden mentés ide is bekerül (a weboldal mappájának tartalma). A GitHub-tokennek ehhez a repóhoz is kell írási jog."));
      if (b && b.repo) box.append(h("button", { class: "btn sm", text: "Teljes szinkron most", onclick: function (e) {
        var btn = e.target; btn.disabled = true;
        api("clients", { action: "sync", site: s.id }).then(function () { toast("Szinkronizálva → " + b.repo + " ✓"); })
          .catch(function (err) { toast(err.message, true); }).finally(function () { btn.disabled = false; });
      } }));

      renderClientAdmins(box, s, b);
      renderBrand(box, s);
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

  // ------------------------------------------------------------ Kunden-Admins
  function clientAdminUrl(s) { return "https://" + ROOT_DOMAIN + "/" + s.slug + "/admin/"; }

  function renderClientAdmins(box, s, b) {
    box.append(h("div", { class: "sec-title", text: "Ügyfél-admin" }));
    if (!b) { box.append(h("p", { class: "hint", text: "Közzététel után hozhatsz létre ügyfél-admint." })); return; }
    box.append(h("p", { class: "hint", style: "margin:-4px 0 10px" }, "Az ügyfél a saját, ",
      h("a", { href: clientAdminUrl(b), target: "_blank", rel: "noopener", text: ROOT_DOMAIN + "/" + b.slug + "/admin/" }),
      " oldalán szerkesztheti a weboldalát (szövegek, képek, sorrend). Mentéskor azonnal élesedik."));
    var wrap = h("div", { class: "clients" }, h("div", { class: "spin" }));
    box.append(wrap);
    var draw = function (v) {
      wrap.innerHTML = "";
      var list = h("ul", { class: "hist" });
      v.accounts.forEach(function (a) {
        list.append(h("li", null,
          h("span", { class: "t" }, h("b", { text: a.name }), h("small", { text: "@" + a.username + " · " + (a.totp ? "2FA bekapcsolva" : "2FA nincs") + " · " + fmtDate(a.createdAt) })),
          h("span", { class: "acts-row" },
            h("button", { class: "btn sm", text: "Jelszó-link", title: "Új jelszó beállítására szolgáló link", onclick: function () { act({ action: "reset", account: a.id }, "Jelszó-visszaállító link"); } }),
            a.totp ? h("button", { class: "btn sm", text: "2FA törlése", onclick: function () {
              ask("2FA törlése?", a.name + " legközelebb csak jelszóval lép be, és újra bekapcsolhatja a kétlépcsős azonosítást.", "Törlés", true).then(function (y) { if (y) act({ action: "reset2fa", account: a.id }); });
            } }) : null,
            h("button", { class: "btn sm danger", text: "Törlés", onclick: function () {
              ask("Ügyfél-admin törlése?", a.name + " (@" + a.username + ") nem tud többé belépni.", "Törlés", true).then(function (y) { if (y) act({ action: "delete", account: a.id }); });
            } }))));
      });
      v.invites.forEach(function (i) {
        list.append(h("li", { class: "muted" },
          h("span", { class: "t" }, h("b", { text: i.kind === "reset" ? "Jelszó-link (nem használt)" : "Meghívó (még nem regisztrált)" }), h("small", { text: "lejár: " + fmtDate(new Date(i.exp).toISOString()) })),
          h("button", { class: "btn sm", text: "Visszavonás", onclick: function () { act({ action: "revoke", invite: i.id }); } })));
      });
      if (!v.accounts.length && !v.invites.length) list.append(h("li", { class: "muted", text: "Még nincs ügyfél-admin." }));
      wrap.append(list, h("button", { class: "btn primary sm", style: "margin-top:10px", text: "+ Admin létrehozása (meghívó link)", onclick: function () { act({ action: "invite" }, "Meghívó link"); } }));
    };
    function act(data, linkTitle) {
      data.site = s.id;
      return api("clients", data).then(function (v) { draw(v); if (v.link) showLink(linkTitle, v.link, s); })
        .catch(function (e) { toast(e.message, true); });
    }
    api("clients?site=" + encodeURIComponent(s.id)).then(draw).catch(function (e) { wrap.innerHTML = ""; wrap.append(h("p", { class: "err-text", text: e.message })); });
  }

  function showLink(title, link, s) {
    var inp = h("input", { class: "inp", value: link, readonly: true });
    var msg = "Hallo! Hier ist der Zugang zu deinem Website-Admin für " + s.name + ": " + link + " (Link gilt 7 Tage)";
    ask(title, h("div", null,
      h("p", { class: "muted", text: "Küldd el ezt a linket az ügyfélnek. 7 napig érvényes, egyszer használható." }), inp,
      h("div", { class: "row", style: "justify-content:flex-start;margin-top:10px" },
        h("button", { class: "btn sm", type: "button", text: "Másolás", onclick: function () { inp.select(); navigator.clipboard.writeText(link).then(function () { toast("Kimásolva ✓"); }); } }),
        h("a", { class: "btn sm", href: "https://wa.me/?text=" + encodeURIComponent(msg), target: "_blank", rel: "noopener", text: "Küldés WhatsAppon" }))), null);
  }

  function renderBrand(box, s) {
    box.append(h("div", { class: "sec-title", text: "Ügyfél-admin arculata" }));
    box.append(h("p", { class: "hint", style: "margin:-4px 0 10px", text: "Az ügyfél-admin automatikusan a weboldal logóját és színeit használja. Itt felülírhatod." }));
    s.brand = s.brand || {};
    function color(key, label) {
      var i = h("input", { type: "color", value: s.brand[key] || "#888888", style: s.brand[key] ? "" : "opacity:.45" });
      var clr = h("button", { class: "btn sm ghost", type: "button", text: s.brand[key] ? "Automatikus" : "auto (a weboldalból)", disabled: !s.brand[key] });
      i.addEventListener("input", function () { s.brand[key] = i.value; i.style.opacity = ""; clr.disabled = false; clr.textContent = "Automatikus"; changed(); });
      clr.onclick = function () { delete s.brand[key]; i.style.opacity = ".45"; clr.disabled = true; clr.textContent = "auto (a weboldalból)"; changed(); };
      return h("label", { class: "f" }, h("span", null, label), h("span", { class: "row", style: "justify-content:flex-start;gap:8px" }, i, clr));
    }
    var logo = h("input", { class: "inp", value: s.brand.logo || "", placeholder: "img/logo.png (üres = automatikus)" });
    logo.addEventListener("input", function () { if (logo.value.trim()) s.brand.logo = logo.value.trim(); else delete s.brand.logo; changed(); });
    var wm = h("input", { class: "inp", value: s.brand.wordmark || "", placeholder: "pl. LOVEKINO (ha nincs logó)" });
    wm.addEventListener("input", function () { if (wm.value.trim()) s.brand.wordmark = wm.value.trim(); else delete s.brand.wordmark; changed(); });
    box.append(h("div", { class: "brand-grid" }, color("accent", "Fő szín"), color("bg", "Háttér")),
      field("Logó (kép a weboldal mappájában)", logo), field("Felirat logó helyett", wm));
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
      if ((b.repo || "") !== (s.repo || "")) out.push(s.name + ": GitHub-repó → " + (s.repo || "nincs"));
      if (JSON.stringify(b.brand || {}) !== JSON.stringify(s.brand || {})) out.push(s.name + ": ügyfél-admin arculat");
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
