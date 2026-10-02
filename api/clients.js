// Betreiber: Kunden-Admins verwalten (einladen, Passwort-Link, 2FA zurücksetzen,
// löschen) und das Kunden-Repo vollständig synchronisieren.
import { send, guard, body } from "./_lib/http.js";
import { randomToken, sha256 } from "./_lib/crypto.js";
import { load, update, publicAccount, INVITE_TTL } from "./_lib/accounts.js";
import { mirrorAll } from "./_lib/mirror.js";

function inviteLink(req, site, token) {
  const host = process.env.ROOT_DOMAIN || req.headers.host || "meinekontaktkarte.com";
  const proto = /^(localhost|127\.)/.test(host) ? "http" : "https";
  return `${proto}://${host}/${site.slug}/admin/#invite=${token}`;
}

function siteView(data, siteId) {
  const now = Date.now();
  return {
    accounts: data.accounts.filter(a => a.site === siteId).map(publicAccount),
    invites: data.invites.filter(i => i.site === siteId && i.exp > now).map(i => ({ id: i.id, kind: i.kind, account: i.account || null, exp: i.exp, createdAt: i.createdAt })),
  };
}

export default async function handler(req, res) {
  const isGet = req.method === "GET";
  if (!(await guard(req, res, { method: isGet ? "GET" : "POST" }))) return;
  try {
    if (isGet) {
      const { data, config } = await load();
      if (!config.sites.some(s => s.id === req.query.site)) return send(res, 404, { error: "Seite nicht gefunden" });
      return send(res, 200, siteView(data, req.query.site));
    }

    const b = await body(req);
    const { config, st, tree } = await load();
    const site = config.sites.find(s => s.id === b.site && s.folder);
    if (!site) return send(res, 404, { error: "Seite nicht gefunden" });

    if (b.action === "sync") {
      const r = await mirrorAll(site, st, tree);
      if (r && r.ok === false) return send(res, 502, { error: r.error });
      return send(res, 200, { ok: true, result: r });
    }

    let link = null;
    const view = await update((data) => {
      const acc = b.account ? data.accounts.find(a => a.id === b.account && a.site === site.id) : null;
      if (b.account && !acc) throw Object.assign(new Error("Konto nicht gefunden"), { status: 404 });
      if (b.action === "invite" || b.action === "reset") {
        const token = randomToken(24);
        data.invites.push({
          id: randomToken(6), hash: sha256(token), site: site.id,
          kind: b.action === "reset" ? "reset" : "register", account: acc ? acc.id : undefined,
          exp: Date.now() + INVITE_TTL, createdAt: new Date().toISOString(),
        });
        link = inviteLink(req, site, token);
      } else if (b.action === "revoke") {
        data.invites = data.invites.filter(i => !(i.id === b.invite && i.site === site.id));
      } else if (b.action === "delete") {
        data.accounts = data.accounts.filter(a => a !== acc);
        data.invites = data.invites.filter(i => i.account !== acc.id);
      } else if (b.action === "reset2fa") {
        acc.totp = null; acc.ver = (acc.ver || 1) + 1;
      } else throw Object.assign(new Error("Unbekannte Aktion"), { status: 400 });
      return siteView(data, site.id);
    }, `${site.name}: ${b.action}`);
    send(res, 200, { ok: true, link, ...view });
  } catch (e) {
    send(res, e.status || 500, { error: String(e.message || e) });
  }
}
