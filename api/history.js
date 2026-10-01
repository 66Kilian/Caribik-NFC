import { send, guard } from "./_lib/http.js";
import { getStorage } from "./_lib/storage.js";
import { CONFIG_PATH, htmlPath, overridesPath } from "./_lib/sites.js";

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;
  try {
    const st = getStorage();
    const { tree } = await st.snapshot();
    const config = JSON.parse((await st.readBlob(tree.get(CONFIG_PATH))).toString("utf8"));
    let paths = [CONFIG_PATH];
    if (req.query.id) {
      const site = config.sites.find(s => s.id === req.query.id);
      if (!site) return send(res, 404, { error: "Seite nicht gefunden" });
      paths = [htmlPath(site), overridesPath(site)];
    }
    send(res, 200, { commits: await st.history(paths, 40) });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
