// Liefert das HTML einer Seite + gespeicherte Übersetzungs-Overrides.
import { send, guard } from "./_lib/http.js";
import { getStorage } from "./_lib/storage.js";
import { CONFIG_PATH, htmlPath, overridesPath, parseOverrides } from "./_lib/sites.js";

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;
  try {
    const st = getStorage();
    const { tree } = await st.snapshot();
    const config = JSON.parse((await st.readBlob(tree.get(CONFIG_PATH))).toString("utf8"));
    let site = config.sites.find(s => s.id === req.query.id);
    if (!site && req.query.folder) site = { folder: String(req.query.folder) };
    if (!site) return send(res, 404, { error: "Seite nicht gefunden" });
    const hp = htmlPath(site), op = overridesPath(site);
    const htmlSha = tree.get(hp);
    if (!htmlSha) return send(res, 404, { error: `${hp} fehlt` });
    const overridesSha = tree.get(op) || null;
    send(res, 200, {
      html: (await st.readBlob(htmlSha)).toString("utf8"),
      htmlSha,
      overrides: overridesSha ? parseOverrides(await st.readBlob(overridesSha)) : {},
      overridesSha,
    });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
