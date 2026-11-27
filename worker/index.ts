// Cloudflare Worker for pineapplehacks.com. The static export in ./out is
// served straight from the assets binding; only /api/* runs this code
// (see `run_worker_first` in wrangler.jsonc).
//
// Applications live in the SQLite storage of one Durable Object
// (`Applications`, named "applications"). Cloudflare creates it on deploy from
// the `migrations` entry in wrangler.jsonc, so there is nothing to set up.

type SqlStorage = {
  exec(query: string, ...bindings: unknown[]): { toArray(): unknown[] };
};

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  APPLICATIONS: {
    idFromName(name: string): unknown;
    get(id: unknown): {
      fetch(input: string, init?: RequestInit): Promise<Response>;
    };
  };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tries allowed per IP address per minute. Counted in memory only, so no IP
// addresses are stored.
const LIMIT = 5;
const WINDOW_MS = 60_000;

export class Applications {
  private sql: SqlStorage;
  private recent = new Map<string, number[]>();

  constructor(state: { storage: { sql: SqlStorage } }) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS applications (
      email TEXT NOT NULL COLLATE NOCASE PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`);
  }

  // Body: an already-validated, lowercased email. Header x-client-ip: sender.
  // 201 saved, 409 already applied, 429 too many tries.
  async fetch(request: Request): Promise<Response> {
    const ip = request.headers.get("x-client-ip") ?? "unknown";
    const now = Date.now();
    const tries = (this.recent.get(ip) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );
    if (tries.length >= LIMIT) return new Response(null, { status: 429 });
    if (this.recent.size > 10_000) this.recent.clear();
    this.recent.set(ip, [...tries, now]);

    const inserted = this.sql
      .exec(
        "INSERT INTO applications (email) VALUES (?) ON CONFLICT (email) DO NOTHING RETURNING email",
        await request.text(),
      )
      .toArray();
    return new Response(null, { status: inserted.length ? 201 : 409 });
  }
}

const json = (status: number, body: object) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

// POST /api/apply {"email": "..."}: saves one application per email.
async function apply(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { error: "Use POST." });
  }

  // Browsers always send Origin on a cross-site POST; refuse other sites.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json(403, { error: "Not allowed." });
  }

  let body: { email?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Send JSON with an email." });
  }
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 320 || !EMAIL.test(email)) {
    return json(400, { error: "That email doesn't look right." });
  }

  const store = env.APPLICATIONS.get(
    env.APPLICATIONS.idFromName("applications"),
  );
  const res = await store.fetch("https://applications/", {
    method: "POST",
    body: email,
    headers: {
      "x-client-ip": request.headers.get("cf-connecting-ip") ?? "unknown",
    },
  });
  switch (res.status) {
    case 201:
      return json(201, { ok: true });
    case 409:
      return json(409, { error: "You've already applied with this email." });
    case 429:
      return json(429, { error: "Too many tries. Please wait a minute." });
    default:
      return json(500, {
        error: "That didn't go through. Please try again later.",
      });
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/apply") return apply(request, env);
    if (pathname.startsWith("/api/")) return json(404, { error: "Not found." });
    return env.ASSETS.fetch(request);
  },
};

export default worker;
