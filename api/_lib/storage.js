// Speicher = Git-Repository. In Produktion über die GitHub-API, lokal
// (scripts/dev.mjs) über ein echtes Git-Arbeitsverzeichnis.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export class ConflictError extends Error {}

export function getStorage() {
  if (process.env.MK_LOCAL_REPO) return localStorage_(process.env.MK_LOCAL_REPO);
  return githubStorage({
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO || "66Kilian/Caribik-NFC",
    branch: process.env.GITHUB_BRANCH || "main",
  });
}

function checkExpect(tree, expect) {
  for (const [p, sha] of Object.entries(expect || {})) {
    const cur = tree.get(p) || null;
    if ((sha || null) !== cur) throw new ConflictError(p);
  }
}

// ---------------------------------------------------------------- GitHub
function githubStorage({ token, repo, branch }) {
  const base = `https://api.github.com/repos/${repo}`;
  async function gh(path, opts = {}) {
    if (!token) throw new Error("GITHUB_TOKEN fehlt (Vercel → Settings → Environment Variables)");
    const r = await fetch(base + path, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: opts.raw ? "application/vnd.github.raw" : "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mk-admin",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!r.ok) {
      const t = await r.text();
      const e = new Error(`GitHub ${r.status}: ${t.slice(0, 200)}`);
      e.status = r.status;
      throw e;
    }
    return opts.raw ? Buffer.from(await r.arrayBuffer()) : r.json();
  }
  const enc = p => p.split("/").map(encodeURIComponent).join("/");

  async function head() {
    return (await gh(`/git/ref/heads/${encodeURIComponent(branch)}`)).object.sha;
  }
  async function treeAt(commitSha) {
    const c = await gh(`/git/commits/${commitSha}`);
    const t = await gh(`/git/trees/${c.tree.sha}?recursive=1`);
    const m = new Map();
    for (const e of t.tree) if (e.type === "blob") m.set(e.path.normalize("NFC"), e.sha);
    m.treeSha = c.tree.sha;
    return m;
  }
  return {
    kind: "github",
    async snapshot() { const h = await head(); return { head: h, tree: await treeAt(h) }; },
    async readBlob(sha) { return gh(`/git/blobs/${sha}`, { raw: true }); },
    async readAt(path, ref) {
      try { return await gh(`/contents/${enc(path)}?ref=${encodeURIComponent(ref || branch)}`, { raw: true }); }
      catch (e) { if (e.status === 404) return null; throw e; }
    },
    async commit({ files, message, expect }) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const h = await head();
        const tree = await treeAt(h);
        checkExpect(tree, expect);
        const entries = [];
        for (const f of files) {
          if (f.content === null) {
            if (tree.has(f.path)) entries.push({ path: f.path, mode: "100644", type: "blob", sha: null });
            continue;
          }
          const blob = await gh(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: f.content.toString("base64"), encoding: "base64" }) });
          entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
        }
        const t = await gh(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: tree.treeSha, tree: entries }) });
        const c = await gh(`/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: t.sha, parents: [h] }) });
        try {
          await gh(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha, force: false }) });
          return { commit: c.sha };
        } catch (e) {
          if (e.status !== 422) throw e; // jemand anderes hat gleichzeitig gepusht → neu versuchen
        }
      }
      throw new ConflictError("branch");
    },
    async history(paths, limit = 30) {
      const seen = new Map();
      for (const p of paths) {
        const list = await gh(`/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(p)}&per_page=${limit}`);
        for (const c of list) seen.set(c.sha, { sha: c.sha, date: c.commit.author.date, message: c.commit.message.split("\n")[0], author: c.commit.author.name });
      }
      return [...seen.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
    },
  };
}

// ---------------------------------------------------------------- lokal
function localStorage_(dir) {
  const git = (args, input) => execFileSync("git", ["-c", "core.quotepath=off", ...args], { cwd: dir, input, maxBuffer: 64 << 20 });
  const gitS = (...a) => git(a).toString().trim();
  function tree() {
    const m = new Map();
    for (const line of git(["ls-tree", "-r", "-z", "HEAD"]).toString().split("\0")) {
      const mm = line.match(/^\d+ blob ([0-9a-f]+)\t(.*)$/);
      if (mm) m.set(mm[2].normalize("NFC"), mm[1]);
    }
    return m;
  }
  return {
    kind: "local",
    async snapshot() { return { head: gitS("rev-parse", "HEAD"), tree: tree() }; },
    async readBlob(sha) { return git(["cat-file", "blob", sha]); },
    async readAt(path, ref) {
      try { return git(["show", `${ref || "HEAD"}:${path}`]); } catch { return null; }
    },
    async commit({ files, message, expect }) {
      checkExpect(tree(), expect);
      for (const f of files) {
        const abs = join(dir, f.path);
        if (f.content === null) { if (existsSync(abs)) rmSync(abs); continue; }
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, f.content);
      }
      git(["add", "-A", "--", ...files.map(f => f.path)]);
      git(["-c", "user.name=mk-admin", "-c", "user.email=admin@localhost", "commit", "-q", "-m", message]);
      return { commit: gitS("rev-parse", "HEAD") };
    },
    async history(paths, limit = 30) {
      const out = git(["log", `-n${limit}`, "--format=%H%x1f%aI%x1f%an%x1f%s", "--", ...paths]).toString().trim();
      return out ? out.split("\n").map(l => { const [sha, date, author, message] = l.split("\x1f"); return { sha, date, author, message }; }) : [];
    },
  };
}

