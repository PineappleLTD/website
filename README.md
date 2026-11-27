# Pineapple website

Pineapple's landing page, built with Next.js and a Three.js particle animation.

## Live link

https://pineapplehacks.com/
https://pineapple-website-vum8.onrender.com/

## Local development

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

## Production build

```bash
npm run build
```

The site exports HTML, JavaScript, styles, fonts, and images to `out/`. To
preview the production export, serve `out/` with a static HTTP server.

## Applications (Cloudflare only)

The "apply" tab posts to `/api/apply`, a small Cloudflare Worker
(`worker/index.ts`). It stores one row per email in the `applications` table
of a Durable Object's SQLite storage, which Cloudflare creates when the Worker
deploys. To read the applications, open the `website` Worker's `Applications`
Durable Object in the Cloudflare dashboard. The Render copy has no Worker, so
the form only works on https://pineapplehacks.com/.

To run the site with the Worker locally:

```bash
npm run build
npx wrangler dev   # local data goes to .wrangler/state
```

## Render hosting

Create a Render **Static Site** linked to this repository with these settings:

- Branch: `main`
- Build command: `npm ci --include=dev && npm run build`
- Publish directory: `out`
- Node.js version: `22` (`NODE_VERSION` environment variable)
- `SKIP_INSTALL_DEPS=true` (the build command installs dependencies)

Enable automatic deploys to publish changes pushed to `main`. The animated
background runs in the visitor's browser.
