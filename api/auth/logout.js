import { send, guard, setSessionCookie } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!(await guard(req, res, { method: "POST", auth: false }))) return;
  setSessionCookie(req, res, "", 0);
  send(res, 200, { ok: true });
}
