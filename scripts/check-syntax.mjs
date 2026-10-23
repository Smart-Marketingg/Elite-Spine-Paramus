// Parse every Worker/portal/site script so a typo never reaches a deploy.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../Elite Spine Paramus (1)/', import.meta.url));
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!['node_modules', 'uploads', 'images', '.wrangler'].includes(f)) walk(p); } else if (p.endsWith('.js')) files.push(p); } };
['functions', 'worker', 'admin'].forEach((d) => walk(join(root, d)));
['app.js', 'blog-live.js', 'blog-post.js', 'blog-posts.js', 'services.js', 'redirect-map.js'].forEach((f) => files.push(join(root, f)));
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { bad++; console.error(`✗ ${f}\n${r.stderr}`); }
}
console.log(bad ? `${bad} file(s) failed` : `${files.length} files parse`);
process.exit(bad ? 1 : 0);
