#!/usr/bin/env node

/**
 * Build script for Grey Lathrop's resume
 *
 * Canonical outputs (from resume.json):
 * - dist/index.html (rendered resume, 'even' theme + dark injection)
 * - dist/resume.json / dist/resume.yaml
 * - dist/resume.pdf (styled) and dist/resume-ats.pdf ('flat' theme, ATS-safe)
 * - dist/assets/
 *
 * Views (from views/*.json, filter/overlay files applied over resume.json):
 * - dist/views/<name>/index.html, resume.json, resume.pdf, resume-ats.pdf
 * - dist/views/index.html (index of all views)
 *
 * Uses resume-cli (`resume export/validate/audit`), not resumed.
 */

import { execSync } from 'child_process';
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  cpSync,
  existsSync,
  readdirSync,
} from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Configuration
const THEME = 'even';
const ATS_THEME = 'flat';
const RESUME_FILE = 'resume.json';
const DIST_DIR = 'dist';
const VIEWS_DIR = 'views';

// resume-cli honors RESUME_PUPPETEER_NO_SANDBOX; the CI runner requires it.
const isCI = process.env.CI === 'true';
const buildEnv = {
  ...process.env,
  ...(isCI ? { RESUME_PUPPETEER_NO_SANDBOX: 'true' } : {}),
};

const run = (cmd) =>
  execSync(cmd, { cwd: rootDir, stdio: 'inherit', env: buildEnv });

// ── Views: filter/overlay merging ────────────────────────────────────────────
//
// A view file (views/<name>.json) selects and lightly overrides content from
// the canonical resume.json. Selections reference canonical content BY EXACT
// TEXT (not index), and every selection is validated: if an edit to
// resume.json invalidates a selection, the build fails with a list of
// culprits. Views never duplicate prose.
//
// Schema:
// {
//   "name": "sre",                          // required; output dir name
//   "description": "...",                   // shown on the views index page
//   "label": "...",                         // overrides basics.label
//   "summary": "...",                       // overrides basics.summary
//   "work": {                               // ordered subset of work entries
//     "Torc Robotics": {                    // must match canonical work[].name
//       "summary": "optional override",
//       "highlights": ["exact canonical highlight text", ...]  // ordered subset
//     }
//   },
//   "skills": ["Cloud & Infrastructure", ...],   // ordered subset of skill names
//   "projects": ["Palimpsest", ...],             // ordered subset of project names
//   "references": ["Rohit", "Joe Stump"],        // prefix-matched subset
//   "referencesAdd": [{ "name": "...", "reference": "..." }]  // extras (from references-archive.md)
// }
//
// Any omitted key means "keep canonical, in canonical order".

function applyView(canonical, view) {
  const resume = structuredClone(canonical);
  const errors = [];

  if (view.label) resume.basics.label = view.label;
  if (view.summary) resume.basics.summary = view.summary;

  if (view.work) {
    resume.work = Object.entries(view.work).map(([name, tweak]) => {
      const entry = canonical.work.find((w) => w.name === name);
      if (!entry) {
        errors.push(`work entry "${name}" not found in resume.json`);
        return null;
      }
      const merged = structuredClone(entry);
      if (tweak.summary) merged.summary = tweak.summary;
      if (tweak.highlights) {
        for (const h of tweak.highlights) {
          if (!entry.highlights?.includes(h)) {
            errors.push(
              `highlight not found in "${name}": "${h.slice(0, 70)}..."`,
            );
          }
        }
        merged.highlights = tweak.highlights.filter((h) =>
          entry.highlights?.includes(h),
        );
      }
      return merged;
    }).filter(Boolean);
  }

  if (view.skills) {
    resume.skills = view.skills
      .map((name) => {
        const group = canonical.skills.find((s) => s.name === name);
        if (!group) errors.push(`skill group "${name}" not found in resume.json`);
        return group;
      })
      .filter(Boolean);
  }

  if (view.projects) {
    resume.projects = view.projects
      .map((name) => {
        const project = canonical.projects?.find((p) => p.name === name);
        if (!project) errors.push(`project "${name}" not found in resume.json`);
        return project;
      })
      .filter(Boolean);
  }

  if (view.references || view.referencesAdd) {
    const picked = (view.references || [])
      .map((prefix) => {
        const ref = canonical.references?.find((r) => r.name.startsWith(prefix));
        if (!ref) errors.push(`reference starting "${prefix}" not found in resume.json`);
        return ref;
      })
      .filter(Boolean);
    resume.references = [...picked, ...(view.referencesAdd || [])];
  }

  if (errors.length) {
    throw new Error(
      `View "${view.name}" is out of sync with resume.json:\n  - ${errors.join('\n  - ')}`,
    );
  }
  return resume;
}

// ── HTML post-processing (shared by canonical and views) ─────────────────────

const darkThemeCSS = `
  <style>
    :root {
      --primaryColor: #e0e0e0;
      --secondaryColor: #a0a0a0;
      --accentColor: #c0392b;
      --linkColor: #2ecc71;
      --mutedColor: #2d2d2d;
    }
    body {
      background-color: #1a1a1a;
    }
    article {
      background-color: #1a1a1a;
    }
  </style>
`;

function postprocessHtml(htmlPath, resume) {
  let html = readFileSync(htmlPath, 'utf-8');

  // Inject dark theme CSS overrides
  html = html.replace('</head>', `${darkThemeCSS}</head>`);

  // Inject profile image next to the header (absolute path so it also
  // resolves from dist/views/<name>/ pages)
  if (resume.basics?.image) {
    const imageSrc = resume.basics.image.startsWith('/')
      ? resume.basics.image
      : `/${resume.basics.image}`;
    html = html.replace(
      /<header class="masthead">\s*<h1>([^<]*)<\/h1>\s*<h2>([^<]*)<\/h2>/,
      `<header class="masthead">
    <div style="display: flex; align-items: center; gap: 1em;">
      <img
        src="${imageSrc}"
        alt="${resume.basics.name}"
        class="profile-image"
        style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; flex-shrink: 0;"
      >
      <div>
        <h1>$1</h1>
        <h2>$2</h2>
      </div>
    </div>`,
    );
  }

  writeFileSync(htmlPath, html);
}

// ── Build helpers ────────────────────────────────────────────────────────────

function renderHtml(resumeJsonPath, outPath) {
  run(`npx resume export ${outPath} -t ${THEME} -r ${resumeJsonPath}`);
}

function renderPdfs(resumeJsonPath, outDir) {
  try {
    run(`npx resume export ${outDir}/resume.pdf -t ${THEME} -r ${resumeJsonPath}`);
    run(`npx resume export ${outDir}/resume-ats.pdf -t ${ATS_THEME} -r ${resumeJsonPath}`);
  } catch (error) {
    console.warn('Warning: PDF generation failed (Chrome may not be available)');
    console.warn('PDFs will be generated in CI instead.');
  }
}

function audit(resumeJsonPath) {
  try {
    run(`npx resume audit ${resumeJsonPath} -t ${ATS_THEME}`);
  } catch (error) {
    console.warn('Warning: ATS audit failed (Chrome may not be available)');
  }
}

// ── Canonical build ──────────────────────────────────────────────────────────

console.log('Building resume...\n');

mkdirSync(join(rootDir, DIST_DIR), { recursive: true });
mkdirSync(join(rootDir, DIST_DIR, 'assets'), { recursive: true });

const resumePath = join(rootDir, RESUME_FILE);
const resume = JSON.parse(readFileSync(resumePath, 'utf-8'));

console.log('1. Rendering HTML...');
renderHtml(RESUME_FILE, `${DIST_DIR}/index.html`);

console.log('2. Post-processing HTML (dark theme, profile image)...');
postprocessHtml(join(rootDir, DIST_DIR, 'index.html'), resume);

console.log('3. Copying resume.json...');
writeFileSync(join(rootDir, DIST_DIR, 'resume.json'), JSON.stringify(resume, null, 2));

console.log('4. Generating resume.yaml...');
writeFileSync(join(rootDir, DIST_DIR, 'resume.yaml'), YAML.stringify(resume));

console.log('5. Copying assets...');
const assetsDir = join(rootDir, 'assets');
if (existsSync(assetsDir)) {
  cpSync(assetsDir, join(rootDir, DIST_DIR, 'assets'), { recursive: true });
}

const cnamePath = join(rootDir, 'CNAME');
if (existsSync(cnamePath)) {
  cpSync(cnamePath, join(rootDir, DIST_DIR, 'CNAME'));
  console.log('6. Copied CNAME...');
}

// Required for GitHub Pages to serve PDFs and other assets
writeFileSync(join(rootDir, DIST_DIR, '.nojekyll'), '');

console.log('7. Generating PDFs...');
renderPdfs(RESUME_FILE, DIST_DIR);

console.log('8. ATS audit (canonical)...');
audit(RESUME_FILE);

// ── Views ────────────────────────────────────────────────────────────────────

const viewsDir = join(rootDir, VIEWS_DIR);
const viewFiles = existsSync(viewsDir)
  ? readdirSync(viewsDir).filter((f) => f.endsWith('.json')).sort()
  : [];

const builtViews = [];

if (viewFiles.length > 0) {
  console.log(`\nBuilding ${viewFiles.length} view(s)...`);
  let step = 9;

  for (const file of viewFiles) {
    const view = JSON.parse(readFileSync(join(viewsDir, file), 'utf-8'));
    if (!view.name) throw new Error(`View file ${file} is missing "name"`);

    console.log(`${step}. View "${view.name}"...`);
    const viewResume = applyView(resume, view); // throws if out of sync

    const outDir = join(DIST_DIR, VIEWS_DIR, view.name);
    mkdirSync(join(rootDir, outDir), { recursive: true });

    const viewJsonPath = `${outDir}/resume.json`;
    writeFileSync(join(rootDir, viewJsonPath), JSON.stringify(viewResume, null, 2));

    renderHtml(viewJsonPath, `${outDir}/index.html`);
    postprocessHtml(join(rootDir, outDir, 'index.html'), viewResume);
    renderPdfs(viewJsonPath, outDir);
    audit(viewJsonPath);

    builtViews.push(view);
    step++;
  }

  // Simple index page linking all views
  const links = builtViews
    .map(
      (v) =>
        `      <li><a href="${v.name}/">${v.name}</a>${
          v.description ? ` — ${v.description}` : ''
        } (<a href="${v.name}/resume.pdf">pdf</a>, <a href="${v.name}/resume-ats.pdf">ats pdf</a>)</li>`,
    )
    .join('\n');
  writeFileSync(
    join(rootDir, DIST_DIR, VIEWS_DIR, 'index.html'),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Resume views — ${resume.basics.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #1a1a1a; color: #e0e0e0; font-family: Helvetica, Arial, sans-serif; max-width: 40em; margin: 3em auto; padding: 0 1em; }
    a { color: #2ecc71; }
    li { margin: 0.6em 0; }
  </style>
</head>
<body>
  <h1>Resume views</h1>
  <p>Tailored framings of <a href="/">the canonical resume</a>:</p>
  <ul>
${links}
  </ul>
</body>
</html>
`,
  );
}

console.log('\nBuild complete! Output in dist/');
console.log('  - index.html, resume.json, resume.yaml');
console.log('  - resume.pdf, resume-ats.pdf (if Chrome available)');
console.log('  - assets/');
for (const v of builtViews) {
  console.log(`  - views/${v.name}/ (html, json, pdfs)`);
}
