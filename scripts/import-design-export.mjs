// Copy a Claude Design export into the site folder WITHOUT touching the CRM.
//
//   node scripts/import-design-export.mjs "/path/to/Elite Spine Paramus"            # dry run: shows what would change
//   node scripts/import-design-export.mjs "/path/to/Elite Spine Paramus" --apply    # copy
//
// Rules:
//  - Only site files are considered (HTML/CSS/JS at the top level, images/, _headers, _redirects, robots, sitemap, llms.txt).
//  - The export's crm/backend/admin/functions/worker/deploy/export/uploads/*.md folders and files are always ignored.
//  - app.js and styles.css are copied only if the incoming copy still contains the CRM wiring
//    (honeypot, Turnstile, /api/lead). Otherwise the script stops and tells you to update Claude Design first.
import { readdirSync, statSync, readFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , srcArg, flag] = process.argv;
if (!srcArg) { console.error('usage: node scripts/import-design-export.mjs <export folder> [--apply]'); process.exit(2); }
const apply = flag === '--apply';
const SRC = srcArg.replace(/\/$/, '');
const DEST = fileURLToPath(new URL('../Elite Spine Paramus (1)/', import.meta.url)).replace(/\/$/, '');

const SITE_EXT = new Set(['.html', '.css', '.js', '.xml', '.txt', '.ico', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif', '.json', '.webmanifest']);
const TOP_FILES_OK = new Set(['_headers', '_redirects', 'robots.txt', 'sitemap.xml', 'llms.txt']);
const SKIP_DIRS = new Set(['admin', 'functions', 'worker', 'backend', 'backend-complete', 'backend-fix-upload', 'crm', 'crm-github-upload', 'cron-worker', 'cron-worker-deploy', 'deploy', 'export', 'uploads', 'google-apps-script', 'private-setup-kit', 'node_modules', '.git', '.wrangler', 'screenshots', '_ds']);
const SKIP_FILES = /^(CRM Admin\.html|.*\.md|.*\.sql|.*\.gs|wrangler\..*|package.*\.json|\.DS_Store|\.assetsignore|\.gitignore|\.dev\.vars.*)$/i;

// What must survive in the two CRM-dependent site files.
const GUARDS = {
  'app.js': ['/api/config', 'cf-turnstile-response', 'name="website"', "fetch('/api/lead'", 'X-Requested-With'],
  'styles.css': ['.cform__turnstile']
};

function walk(dir, rel = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name), r = rel ? rel + '/' + name : name;
    const st = statSync(p);
    if (st.isDirectory()) {
      if (rel === '' && SKIP_DIRS.has(name)) continue;
      if (rel === '' && name !== 'images') continue; // only images/ is a site folder
      out.push(...walk(p, r));
    } else {
      if (SKIP_FILES.test(name)) continue;
      if (rel === '' && !(SITE_EXT.has(extname(name).toLowerCase()) || TOP_FILES_OK.has(name))) continue;
      out.push(r);
    }
  }
  return out;
}

const files = walk(SRC);
const same = (a, b) => existsSync(b) && readFileSync(a).equals(readFileSync(b));
const changed = files.filter(r => !same(join(SRC, r), join(DEST, r)));
const added = changed.filter(r => !existsSync(join(DEST, r)));
const blocked = [];
for (const [file, needles] of Object.entries(GUARDS)) {
  if (!changed.includes(file)) continue;
  const text = readFileSync(join(SRC, file), 'utf8');
  const missing = needles.filter(n => !text.includes(n));
  if (missing.length) blocked.push({ file, missing });
}

console.log(`Export: ${SRC}\nSite files considered: ${files.length}, changed: ${changed.length} (new: ${added.length})`);
for (const r of changed) console.log(`  ${added.includes(r) ? 'A' : 'M'} ${r}`);
if (blocked.length) {
  console.error('\nSTOP: the export would roll back CRM wiring. Update these files in Claude Design first, or keep the repo copy:');
  for (const b of blocked) console.error(`  ${b.file} is missing: ${b.missing.join(', ')}`);
  process.exit(1);
}
if (!apply) { console.log(changed.length ? '\nDry run. Re-run with --apply to copy.' : '\nNothing to do.'); process.exit(0); }
for (const r of changed) { mkdirSync(dirname(join(DEST, r)), { recursive: true }); copyFileSync(join(SRC, r), join(DEST, r)); }
console.log(`\nCopied ${changed.length} file(s). Review with: git status && git diff --stat`);
