#!/usr/bin/env node

/**
 * Build script for Grey Lathrop's resume
 * 
 * Generates:
 * - dist/index.html (rendered resume)
 * - dist/resume.json (JSON Resume data)
 * - dist/resume.yaml (YAML version)
 * - dist/resume.pdf (PDF export)
 * - dist/assets/ (images, etc.)
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Configuration
const THEME = 'jsonresume-theme-even';
const RESUME_FILE = 'resume.json';
const DIST_DIR = 'dist';

console.log('Building resume...\n');

// Ensure dist directory exists
mkdirSync(join(rootDir, DIST_DIR), { recursive: true });
mkdirSync(join(rootDir, DIST_DIR, 'assets'), { recursive: true });

// Read resume data
const resumePath = join(rootDir, RESUME_FILE);
const resume = JSON.parse(readFileSync(resumePath, 'utf-8'));

// Step 1: Render HTML
console.log('1. Rendering HTML...');
try {
  execSync(`npx resumed render ${RESUME_FILE} -o ${DIST_DIR}/index.html -t ${THEME}`, {
    cwd: rootDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Failed to render HTML:', error.message);
  process.exit(1);
}

// Step 2: Copy resume.json
console.log('2. Copying resume.json...');
writeFileSync(
  join(rootDir, DIST_DIR, 'resume.json'),
  JSON.stringify(resume, null, 2)
);

// Step 3: Generate YAML
console.log('3. Generating resume.yaml...');
writeFileSync(
  join(rootDir, DIST_DIR, 'resume.yaml'),
  YAML.stringify(resume)
);

// Step 4: Copy assets
console.log('4. Copying assets...');
const assetsDir = join(rootDir, 'assets');
if (existsSync(assetsDir)) {
  cpSync(assetsDir, join(rootDir, DIST_DIR, 'assets'), { recursive: true });
}

// Step 5: Copy CNAME if it exists
const cnamePath = join(rootDir, 'CNAME');
if (existsSync(cnamePath)) {
  cpSync(cnamePath, join(rootDir, DIST_DIR, 'CNAME'));
  console.log('5. Copied CNAME...');
}

// Step 6: Generate PDF (optional - may fail if Puppeteer/Chrome not available)
console.log('6. Generating PDF...');
try {
  execSync(`npx resumed export ${RESUME_FILE} -o ${DIST_DIR}/resume.pdf -t ${THEME}`, {
    cwd: rootDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.warn('Warning: PDF generation failed (Puppeteer/Chrome may not be available)');
  console.warn('PDF will be generated in CI instead.');
}

console.log('\nBuild complete! Output in dist/');
console.log('  - index.html');
console.log('  - resume.json');
console.log('  - resume.yaml');
console.log('  - resume.pdf (if Puppeteer available)');
console.log('  - assets/');
