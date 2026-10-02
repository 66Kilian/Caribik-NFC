import { send, env, isConfigured } from "../_lib/http.js";
import { isAdminRequest } from "../../lib/session.js";

export default async function handler(req, res) {
  const loggedIn = await isAdminRequest(req.headers.cookie, env().sessionSecret);
  send(res, 200, {
    configured: isConfigured(),
    loggedIn,
    translate: Boolean(process.env.DEEPL_API_KEY),
    storage: process.env.MK_LOCAL_REPO ? "local" : (process.env.GITHUB_TOKEN ? "github" : "missing"),
  });
}
