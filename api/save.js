// Speichert alle Änderungen als EIN Commit → Vercel deployt automatisch.
import { send, guard, body } from "./_lib/http.js";
import { getStorage, ConflictError } from "./_lib/storage.js";
import { mirrorFiles } from "./_lib/mirror.js";
import { CONFIG_PATH, configFiles, htmlPath, overridesPath, validateConfig, validUpload, renderOverrides, cleanOverrides } from "./_lib/sites.js";

const MAX_HTML = 3 << 20;
const MAX_UPLOAD = 3 << 20;

export default async function handler(req, res) {
  if (!(await guard(req, res, { method: "POST" }))) return;
  const b = await body(req);
  try {
    const st = getStorage();
    const { tree } = await st.snapshot();
    const prev = JSON.parse((await st.readBlob(tree.get(CONFIG_PATH))).toString("utf8"));
    const expect = { [CONFIG_PATH]: b.configSha || null };
    const files = [];

    let config = prev;
    try { config = validateConfig(b.config || prev, prev, tree); } catch (msg) { return send(res, 400, { error: String(msg) }); }
    files.push(...configFiles(config));

    const byId = new Map(config.sites.map(s => [s.id, s]));
    for (const p of b.pages || []) {
      const site = byId.get(p.id);
      if (!site) return send(res, 400, { error: `Unbekannte Seite ${p.id}` });
      if (typeof p.html === "string") {
        if (p.html.length > MAX_HTML || !/<html[\s>]/i.test(p.html)) return send(res, 400, { error: `HTML von ${site.name} ungültig` });
        expect[htmlPath(site)] = p.htmlSha || null;
        files.push({ path: htmlPath(site), content: Buffer.from(p.html, "utf8") });
      }
      if (p.overrides) {
        const o = cleanOverrides(p.overrides);
        expect[overridesPath(site)] = p.overridesSha || null;
        files.push({ path: overridesPath(site), content: Object.keys(o).length ? Buffer.from(renderOverrides(o)) : null });
      }
      for (const u of p.uploads || []) {
        if (!validUpload(u.path)) return send(res, 400, { error: `Ungültiger Bildname ${u.path}` });
        const buf = Buffer.from(String(u.data || ""), "base64");
        if (!buf.length || buf.length > MAX_UPLOAD) return send(res, 400, { error: "Bild zu groß (max. 3 MB)" });
        const path = (site.folder ? site.folder + "/" : "") + u.path;
        if (tree.has(path)) return send(res, 400, { error: `${u.path} existiert schon` });
        files.push({ path, content: buf });
      }
    }

    const summary = String(b.summary || "Änderungen").replace(/\s+/g, " ").slice(0, 200);
    const r = await st.commit({ files, message: `admin: ${summary}`, expect });
    const mirror = [];
    for (const site of config.sites) {
      const m = await mirrorFiles(site, files, `admin: ${summary}`);
      if (m && m.ok === false) mirror.push(m.error);
    }
    send(res, 200, { ok: true, commit: r.commit, rev: config.rev, mirrorErrors: mirror });
  } catch (e) {
    if (e instanceof ConflictError) return send(res, 409, { error: "Inzwischen wurde etwas anderes gespeichert. Bitte neu laden – deine Änderungen bleiben als Entwurf erhalten." });
    send(res, 500, { error: String(e.message || e) });
  }
}
