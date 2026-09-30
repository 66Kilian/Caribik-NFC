import { send, guard } from "./_lib/http.js";
import { getStorage } from "./_lib/storage.js";
import { CONFIG_PATH, discover } from "./_lib/sites.js";

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;
  try {
    const st = getStorage();
    const { head, tree } = await st.snapshot();
    const configSha = tree.get(CONFIG_PATH) || null;
    const config = configSha ? JSON.parse((await st.readBlob(configSha)).toString("utf8")) : { groups: [], sites: [] };
    send(res, 200, { head, config, configSha, discovered: discover(tree, config) });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
