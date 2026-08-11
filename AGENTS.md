# AGENTS.md

Guidance for AI agents (and humans) working on Grey Lathrop's resume.

## Project Overview

This repo builds a personal resume site from a single [JSON Resume](https://jsonresume.org/schema/) data file. The build renders HTML, PDF, and YAML into `dist/`, which is deployed to GitHub Pages via GitHub Actions.

**Live site:** https://grey.ember.st

## Repository Layout

```
resume.json          # THE source of truth. All content edits happen here.
scripts/build.mjs    # Build script: render HTML, inject customizations, export PDF/YAML
assets/              # Static assets (profile image, etc.) copied to dist/
CNAME                # GitHub Pages custom domain
dist/                # GENERATED. Never edit directly; never commit hand changes here.
.github/workflows/   # CI: build + deploy to GitHub Pages on push to main
```

## Commands

| Command | Purpose |
|---|---|
| `npm run validate` | Validate `resume.json` against the JSON Resume schema |
| `npm run build` | Full build into `dist/` (HTML + JSON + YAML + PDF*) |
| `npm run render` | Render HTML only |
| `npm run pdf` | Export PDF only |
| `npm run dev` | Serve `dist/` locally for review |

\* PDF generation requires Puppeteer/Chrome. It may fail locally; CI installs Chrome and always generates the PDF. A local PDF failure is not a build blocker.

## Standard Workflow for Content Changes

1. Edit `resume.json` (and only `resume.json` for content changes).
2. Bump `meta.lastModified` (YYYY-MM-DD) and `meta.version` (semver-ish, e.g. `v1.2.0`).
3. Run `npm run validate` — must pass before committing.
4. Run `npm run build` and eyeball `dist/index.html` (via `npm run dev`) for layout regressions, especially after touching `basics` (the header is custom-injected).
5. Commit. Pushing to `main` triggers deployment.

## Content Conventions

Follow these when editing `resume.json` so the document stays consistent:

### Schema & Formatting
- JSON Resume schema **v1.0.0** (`$schema` field at top of file).
- Dates use `YYYY-MM` (e.g. `"startDate": "2025-05"`). Do NOT compensate for rendering bugs by shifting dates — the vendored theme (see below) renders `YYYY-MM` correctly; keep the data true.
- Work entries are in **reverse chronological order**.
- 4-space JSON indentation (matches the Emacs formatter config).

### Writing Style
- **`basics.summary`**: one paragraph, first-person-implied (no "I"), leading with years of experience and the strongest quantified claims.
- **Work `summary`**: 1–2 sentences framing scope (team size, systems owned, mandate).
- **Work `highlights`**: sentence fragments, no trailing periods, led by a strong past-tense verb ("Directed", "Scaled", "Achieved"), each carrying a **quantified outcome** where possible (uptime %, $ saved, QPS, cluster size, engineer count). Aim for 3–5 per role.
- Order highlights within a role by impact, most impressive first.
- Prefer concrete numbers over adjectives; avoid repeating the same metric phrasing across roles.

### Structural Conventions
- The `work` entry `"Various Companies"` (2005–2012) is an intentional rollup of early-career roles — keep it last and brief.
- `projects` lists personal/self-directed work. Private repos are listed name-only (no `url`); only add a `url` for public repos.
- `skills` are ordered by relevance to target roles, most important first.
- Use plain ASCII punctuation (hyphens, not en/em dashes) in `resume.json` — non-ASCII dashes have been mangled by tooling before.
- `references` are quoted recommendations; include name and title/context in `name`.

## Build System Quirks

**Vendored theme**: `jsonresume-theme-even` is vendored at `vendor/jsonresume-theme-even/` (npm `file:` dependency, symlinked into `node_modules`). Local fixes applied on top of upstream 0.6.1 — keep these when upgrading:

1. `index.js`: `formatDate` parses `YYYY-MM[-DD]` as a local date (upstream parses as UTC midnight, rendering one month early in US timezones).
2. `partials/projects.hbs`: only renders the date range when `startDate` is present (upstream renders "Invalid Date – Present" for undated projects).

`scripts/build.mjs` does more than render — be careful when touching it:

1. **Dark theme injection**: CSS variable overrides are string-replaced into the rendered HTML before `</head>`. Depends on theme markup of `jsonresume-theme-even`.
2. **Profile image injection**: a regex rewrites the `<header class="masthead">` block to add `basics.image` as a circular avatar. If `basics.name`/`label` rendering changes (theme upgrade), this regex may silently stop matching — verify the avatar appears after theme changes.
3. **PDF in CI**: CI sets `CI=true`, which adds `--puppeteer-arg=--no-sandbox`. Keep this; the GitHub Actions runner requires it.
4. **`.nojekyll`** is generated into `dist/` — required for Pages to serve the PDF. Don't remove.

## What NOT to Do

- Don't edit anything under `dist/` — it's regenerated every build.
- Don't rename `resume.json` or move it; paths are hardcoded in `package.json` scripts and `build.mjs`.
- Don't remove schema-optional fields that the build depends on (`basics.image`, `basics.name`, `basics.label`).
- Don't commit without `npm run validate` passing.

## Views (Planned)

Customized framings of the resume (e.g. SRE-focused, architect-focused) will live in `views/` as filter/overlay files applied at build time. This section will be updated when that system lands.
