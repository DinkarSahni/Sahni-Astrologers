import { mkdir, copyFile, readdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = resolve(root, 'public/vendor');
await mkdir(vendor, { recursive: true });
// Retain the upstream MIT copyright and licence embedded in this module.
await copyFile(resolve(root, 'node_modules/astronomy-engine/esm/astronomy.js'), resolve(vendor, 'astronomy-engine.js'));
const fonts = resolve(root, 'public/fonts');
await mkdir(fonts, { recursive: true });
for (const [family, source, target] of [
  ['playfair-display', 'playfair-display-latin-wght-normal.woff2', 'playfair-display-normal.woff2'],
  ['playfair-display', 'playfair-display-latin-wght-italic.woff2', 'playfair-display-italic.woff2'],
  ['dm-sans', 'dm-sans-latin-wght-normal.woff2', 'dm-sans-normal.woff2'],
  ['dm-sans', 'dm-sans-latin-wght-italic.woff2', 'dm-sans-italic.woff2'],
  ['dancing-script', 'dancing-script-latin-wght-normal.woff2', 'dancing-script-normal.woff2'],
  ['noto-sans-devanagari', 'noto-sans-devanagari-devanagari-wght-normal.woff2', 'noto-devanagari-normal.woff2'],
]) {
  await copyFile(resolve(root, `node_modules/@fontsource-variable/${family}/files/${source}`), resolve(fonts, target));
}
for (const family of ['playfair-display', 'dm-sans', 'dancing-script', 'noto-sans-devanagari']) {
  await copyFile(resolve(root, `node_modules/@fontsource-variable/${family}/LICENSE`), resolve(fonts, `${family}-LICENSE.txt`));
}

async function check(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (['vendor', 'node_modules', '.git', 'data'].includes(item.name)) continue;
    const path = resolve(directory, item.name);
    if (item.isDirectory()) await check(path);
    else if (/\.(mjs|js)$/.test(item.name)) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
await check(root);
for (const name of ['index.html', 'app.js', 'styles.css', 'chart-engine.js', 'chart-cities.js', 'chart-india-data.js', 'chart-location.js', 'chart-options.js', 'chart-divisions.js', 'chart-timing.js', 'chart-record.js', 'chart-diagram.js', 'chart-extras-view.js', 'chart-view.js', 'motion.js', 'visit.js']) {
  await readFile(resolve(root, 'public', name));
}
const html = await readFile(resolve(root, 'public/index.html'), 'utf8');
if (/\son[a-z]+\s*=|javascript:|api\.anthropic\.com|YOUR_FORM_ID|rzp_live_XXXX/i.test(html)) {
  throw new Error('Unexpected inline handler, obsolete integration, or placeholder in the production HTML.');
}
console.log('Local fonts and astronomy module prepared; application JavaScript syntax and required assets checked.');
