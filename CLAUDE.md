# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm ci            # install
npm run dev       # dev server at http://localhost:3000
npm run build     # static export to out/
npm run lint      # eslint (next core-web-vitals + typescript configs)
```

There is no test suite. To preview a production build, serve `out/` with any static HTTP server.

## Stack notes

- Next.js 16 (App Router) + React 19 + Three.js + Tailwind v4. Next 16 APIs differ from older versions — check `node_modules/next/dist/docs/` before using framework APIs (see AGENTS.md).
- `next.config.ts` sets `output: "export"`: the Next app is fully static. Nothing that needs a server (route handlers, server actions, dynamic rendering, `next/image` optimization without a loader) will work. The one server-side piece is the Cloudflare Worker in `worker/index.ts` (see Deployment).
- Tailwind is wired through a Turbopack loader rule in `next.config.ts` (`@tailwindcss/turbopack`), not a PostCSS config.
- Global CSS disables text selection on everything except inputs/textareas/contenteditable.

## Architecture

The site is a single landing page:

- `app/page.tsx` (client component) renders a full-screen `ParticleBackground` behind the "pineapple" heading, and fades the text in only after the particle component calls `onReady`.
- `app/components/ParticleBackground.tsx` does all the visual work in one `useEffect`:
  - Loads an image from `public/` (currently `/source.jpg`), samples pixels into particles with probability ~ brightness² (`invert` flips this for dark subjects on light backgrounds), and renders them as `THREE.Points` with a custom GLSL `ShaderMaterial` that animates sway/shimmer.
  - Procedurally generates a full-width "ground" particle field (`generateGround`) for the current camera view. It is rebuilt on resize (debounced) only when aspect/camera changes meaningfully.
  - Image is `WORLD_HEIGHT = 10` world units tall; props like `scale`, `centerY`, `groundLine`, `fuzz` are expressed relative to that or to screen fractions — see the prop doc comments.
  - Disposes geometry/material/renderer on unmount.
- `references/particles.js` is a minified Turbopack bundle kept only as a reference for the original effect. It is not imported by the app; don't edit or lint-fix it.

## Deployment

Static `out/` is deployed two ways (live at https://pineapplehacks.com/):

- **Render Static Site** from `main`: build `npm ci --include=dev && npm run build`, publish dir `out`, `NODE_VERSION=22`, `SKIP_INSTALL_DEPS=true`.
- **Cloudflare** via `wrangler.jsonc` (serves pineapplehacks.com, deployed on push to `main`): serves `./out` as static assets with `404-page` not-found handling. Only `/api/*` runs the Worker in `worker/index.ts`: `POST /api/apply` stores one application per email in D1 (`website-applications`, schema in `migrations/`; apply new migrations with `npx wrangler d1 migrations apply DB --remote` before deploying) and is rate-limited per IP. The Render copy has no Worker, so the apply form fails there.
