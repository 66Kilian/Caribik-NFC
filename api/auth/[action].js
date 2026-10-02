// Ein einziger Endpunkt für /api/auth/login|verify|status|logout – spart
// Vercel-Funktionen (Hobby-Plan: max. 12 pro Deployment, Middleware zählt mit).
import { send } from "../_lib/http.js";
import login from "../_lib/auth/login.js";
import verify from "../_lib/auth/verify.js";
import status from "../_lib/auth/status.js";
import logout from "../_lib/auth/logout.js";

const ACTIONS = { login, verify, status, logout };

export default async function handler(req, res) {
  const fn = Object.prototype.hasOwnProperty.call(ACTIONS, req.query.action) ? ACTIONS[req.query.action] : null;
  if (!fn) return send(res, 404, { error: "Unbekannt" });
  return fn(req, res);
}
