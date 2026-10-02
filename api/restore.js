// Stellt eine frühere Version wieder her (als neuer Commit – nichts geht verloren).
import { send, guard, body } from "./_lib/http.js";
import { getStorage } from "./_lib/storage.js";
import { mirrorFiles } from "./_lib/mirror.js";
import { CONFIG_PATH, configFiles, htmlPath, overridesPath, validateConfig } from "./_lib/sites.js";

export default async function handler(req, res) {
  if (!(await guard(req, res, { method: "POST" }))) return;
  const { id, sha } = await body(req);
  if (!/^[0-9a-f]{7,40}$/.test(String(sha || ""))) return send(res, 400, { error: "Ungültige Version" });
  try {
    const st = getStorage();
    const { tree } = await st.snapshot();
    const current = JSON.parse((await st.readBlob(tree.get(CONFIG_PATH))).toString("utf8"));
    const files = [];
    if (!id) {
      const old = await st.readAt(CONFIG_PATH, sha);
      if (!old) return send(res, 404, { error: "Version nicht gefunden" });
      let cfg;
      try { cfg = validateConfig(JSON.parse(old.toString("utf8")), current, tree); } catch (m) { return send(res, 400, { error: String(m) }); }
      files.push(...configFiles(cfg));
    } else {
      const site = current.sites.find(s => s.id === id);
      if (!site) return send(res, 404, { error: "Seite nicht gefunden" });
      const html = await st.readAt(htmlPath(site), sha);
      if (!html) return send(res, 404, { error: "Version nicht gefunden" });
      files.push({ path: htmlPath(site), content: html });
      files.push({ path: overridesPath(site), content: await st.readAt(overridesPath(site), sha) });
      // Rev erneuern, damit das Admin den Deploy erkennt
      const cfg = { ...current, rev: Math.random().toString(36).slice(2, 10), updatedAt: new Date().toISOString() };
      files.push(...configFiles(cfg));
    }
    const msg = `admin: Version ${sha.slice(0, 7)} wiederhergestellt${id ? ` (${id})` : " (Einstellungen)"}`;
    const r = await st.commit({ files, message: msg });
    if (id) await mirrorFiles(current.sites.find(s => s.id === id), files, msg);
    send(res, 200, { ok: true, commit: r.commit });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
