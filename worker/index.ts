// Cloudflare Worker for pineapplehacks.com. The static export in ./out is
// served straight from the assets binding; only /api/* runs this code
// (see `run_worker_first` in wrangler.jsonc).

type D1Result = { meta: { changes: number } };

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: {
    prepare(query: string): {
      bind(...values: unknown[]): { run(): Promise<D1Result> };
    };
  };
  APPLY_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await env.APPLY_LIMITER.limit({ key: ip })).success) {
    return json(429, { error: "Too many tries. Please wait a minute." });
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

  const { meta } = await env.DB.prepare(
    "INSERT INTO applications (email) VALUES (?) ON CONFLICT (email) DO NOTHING",
  )
    .bind(email)
    .run();
  if (meta.changes === 0) {
    return json(409, { error: "You've already applied with this email." });
  }
  return json(201, { ok: true });
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
