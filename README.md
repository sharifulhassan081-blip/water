# water

Static deployment of **The Museum of Her**.

- `public/index.html` — the standalone museum website (served at `/`)
- `backups/museum-of-her-backup-2026-11-25.json` — portable museum restore file, intentionally outside the public output
- `vercel.json` — static-site output settings

The site is self-contained: photos, stories, styling, and interactions are embedded in the HTML. Fonts and Tailwind are loaded from their public CDNs.
