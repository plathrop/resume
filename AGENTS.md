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
| `npm run validate` | Validate `resume.json` against the JSON Resume schema (resume-cli) |
| `npm run build` | Full build into `dist/` (HTML + JSON + YAML + PDF + ATS PDF + audit) |
| `npm run render` | Render HTML only |
| `npm run pdf` | Export styled PDF only (even theme) |
| `npm run audit` | Print ATS compatibility score (flat theme; goal: stay above 90) |
| `npm run dev` | Serve `dist/` locally for review |

\* PDF generation requires Chrome (via Puppeteer). After a fresh `npm install`, run `npm install-scripts approve puppeteer` — this npm blocks postinstall scripts by default. If Chrome extraction silently fails (known flakiness in the JS extractor), unzip the archives in `~/.cache/puppeteer/chrome*/` manually. CI does a clean `npx puppeteer browsers install chrome` and is unaffected.

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

**Vendored themes**: both themes are vendored under `vendor/` (npm `file:` dependencies, symlinked into `node_modules`). Local fixes — keep these when upgrading:

`jsonresume-theme-even` (on top of upstream 0.6.1):

1. `index.js`: `formatDate` parses `YYYY-MM[-DD]` as a local date (upstream parses as UTC midnight, rendering one month early in US timezones).
2. `partials/projects.hbs`: only renders the date range when `startDate` is present (upstream renders "Invalid Date – Present" for undated projects).

`jsonresume-theme-flat` (ATS PDF theme):

1. `style.css`: Helvetica/Arial stack replaces the Lato web font (web fonts fail the ATS validator's font check).
2. `index.js`: `modernize()` shims legacy schema fields — the theme predates JSON Resume v1 and reads `company`/`website` where the schema uses `name`/`url` (without this, company names silently vanish from the work section).
3. `resume.template`: projects section added (upstream had none).

**Theme compatibility**: `resume-cli` only works with themes exporting a `render(resume)` function (Handlebars-era themes). The new official React themes from the jsonresume.org monorepo (e.g. `jsonresume-theme-professional` 1.x) ship raw JSX and will crash with `Unexpected token '<'` — do not install them without adding a transpile step.

`scripts/build.mjs` does more than render — be careful when touching it:

1. **Dark theme injection**: CSS variable overrides are string-replaced into the rendered HTML before `</head>`. Depends on theme markup of `jsonresume-theme-even`.
2. **Profile image injection**: a regex rewrites the `<header class="masthead">` block to add `basics.image` as a circular avatar. If `basics.name`/`label` rendering changes (theme upgrade), this regex may silently stop matching — verify the avatar appears after theme changes.
3. **PDF in CI**: the workflow sets `CI=true`, and `build.mjs` translates that to `RESUME_PUPPETEER_NO_SANDBOX=true` for resume-cli's Puppeteer. The GitHub Actions runner requires the no-sandbox flag. `puppeteer` is a pinned devDependency (`^23`, matching resume-cli's bundled version) so `npx puppeteer browsers install chrome` installs the exact Chrome build resume-cli expects.
4. **`.nojekyll`** is generated into `dist/` — required for Pages to serve the PDF. Don't remove.

## What NOT to Do

- Don't edit anything under `dist/` — it's regenerated every build.
- Don't rename `resume.json` or move it; paths are hardcoded in `package.json` scripts and `build.mjs`.
- Don't remove schema-optional fields that the build depends on (`basics.image`, `basics.name`, `basics.label`).
- Don't commit without `npm run validate` passing.

## Views

Customized framings of the resume live in `views/` as filter/overlay files (e.g. `sre.json`, `architect.json`, `swe.json`). The build emits each view at `dist/views/<name>/` (index.html, resume.json, resume.pdf, resume-ats.pdf) plus a `dist/views/index.html` directory page.

### How views work

- `resume.json` is the canonical **superset**; all prose lives there.
- A view file **selects** content by exact text match and **overrides** `basics.label`/`basics.summary`. It never duplicates prose.
- Selections are validated at build time: if an edit to `resume.json` invalidates a view selection (e.g. rewording a highlight), **the build fails** naming the culprits. Fix the view file in the same commit.
- The full schema is documented in the header comment of `scripts/build.mjs`.

### Editing rules for views

- When rewording a highlight/skill/project/reference in `resume.json`, grep `views/` for the old string and update every match.
- `referencesAdd` pulls from `references-archive.md` for references not in the canonical curated set.
- Adding a view: create `views/<name>.json`, run `npm run build`, verify `dist/views/<name>/index.html`.
- View summaries/labels follow the same writing conventions as canonical content.
