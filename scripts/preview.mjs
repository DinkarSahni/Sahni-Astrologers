import { build } from 'esbuild';
import { readFile, readdir, mkdir, writeFile, rename, unlink, copyFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createPreviewArchive } from './preview-archive.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(root, 'public');
const outputDirectory = resolve(root, 'preview');
const output = resolve(outputDirectory, 'Sahni-Astrologers.html');
const mimeTypes = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
const embedded = new Set();

function localPath(url, from = publicRoot) {
  const clean = url.trim();
  if (!clean || /^(?:data:|#)/i.test(clean)) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(clean)) {
    throw new Error(`Standalone preview cannot depend on a remote asset: ${clean}`);
  }
  const pathname = decodeURIComponent(clean.split(/[?#]/, 1)[0]);
  const path = resolve(clean.startsWith('/') ? publicRoot : from, pathname.replace(/^\/+/, ''));
  const inside = relative(publicRoot, path);
  if (inside.startsWith('..') || isAbsolute(inside)) throw new Error(`Asset escapes public/: ${clean}`);
  return path;
}

async function dataUrl(url, from) {
  const path = localPath(url, from);
  if (!path) return url;
  const mime = mimeTypes[extname(path).toLowerCase()];
  if (!mime) throw new Error(`Unsupported embedded asset type: ${relative(root, path)}`);
  const bytes = await readFile(path);
  embedded.add(relative(publicRoot, path));
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function replaceAsync(text, pattern, callback) {
  const matches = [...text.matchAll(pattern)];
  const replacements = await Promise.all(matches.map(callback));
  let result = '';
  let position = 0;
  matches.forEach((match, index) => {
    result += text.slice(position, match.index) + replacements[index];
    position = match.index + match[0].length;
  });
  return result + text.slice(position);
}

async function embedCss(path, stack = []) {
  if (stack.includes(path)) throw new Error(`Circular CSS import: ${relative(root, path)}`);
  let css = await readFile(path, 'utf8');
  embedded.add(relative(publicRoot, path));
  css = await replaceAsync(css, /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s);]+))\s*\)?\s*([^;]*);/gi, async (match) => {
    const imported = localPath(match[1] || match[2] || match[3], dirname(path));
    if (!imported || extname(imported) !== '.css') throw new Error('CSS imports must reference local CSS files.');
    const content = await embedCss(imported, [...stack, path]);
    const media = match[4].trim();
    return media ? `@media ${media}{${content}}` : content;
  });
  css = await replaceAsync(css, /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi, async (match) => {
    const url = await dataUrl(match[1] ?? match[2] ?? match[3], dirname(path));
    return `url("${url}")`;
  });
  return css.replace(/<\/style/gi, '<\\/style');
}

let html = await readFile(resolve(publicRoot, 'index.html'), 'utf8');
if (/name=["']site-mode["']/i.test(html)) throw new Error('Production HTML must not already be a standalone preview.');
const stylesheetPattern = /<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])[^>]*>/gi;
let stylesheets = 0;
html = await replaceAsync(html, stylesheetPattern, async (match) => {
  const href = match[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!href) throw new Error('Stylesheet has no quoted href.');
  stylesheets++;
  const path = localPath(href);
  if (!path) throw new Error('Stylesheets must be local files.');
  return `<style>${await embedCss(path)}</style>`;
});
if (!stylesheets) throw new Error('No stylesheet found; refusing to emit an unstyled preview.');

const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script\s*>/gi)];
if (scripts.length !== 1 || localPath(scripts[0][1]) !== resolve(publicRoot, 'app.js')) {
  throw new Error('Preview expects exactly one local public/app.js entry script.');
}
const bundled = await build({
  entryPoints: [resolve(publicRoot, 'app.js')], bundle: true, splitting: false,
  format: 'iife', platform: 'browser', target: 'es2022', minify: true,
  legalComments: 'inline', write: false, sourcemap: false,
  plugins: [{
    name: 'public-absolute-imports',
    setup(builder) {
      builder.onResolve({ filter: /^\// }, (args) => args.kind === 'entry-point' ? undefined : ({ path: localPath(args.path) }));
    },
  }],
});
const javascript = bundled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
html = html.replace(scripts[0][0], '');

// Inline images, favicons and local media. Ordinary navigation and telephone /
// WhatsApp links remain links; they are not requested when the document opens.
html = await replaceAsync(html, /<(?:img|source|link)\b[^>]*>/gi, async (match) => {
  const tag = match[0];
  if (/^<link/i.test(tag) && !/\brel\s*=\s*["'](?:icon|apple-touch-icon)["']/i.test(tag)) {
    if (/\brel\s*=\s*["'](?:preload|preconnect|dns-prefetch|modulepreload)["']/i.test(tag)) return '';
    return tag;
  }
  let changed = await replaceAsync(tag, /\b(src|href)\s*=\s*(["'])([^"']+)\2/gi, async (attribute) => `${attribute[1]}="${await dataUrl(attribute[3])}"`);
  changed = await replaceAsync(changed, /\bsrcset\s*=\s*(["'])([^"']+)\1/gi, async (attribute) => {
    if (/\bdata:/i.test(attribute[2])) throw new Error('Use src for embedded images instead of an ambiguous data-URL srcset.');
    const sources = await Promise.all(attribute[2].split(',').map(async (source) => {
      const [url, ...descriptor] = source.trim().split(/\s+/);
      return [await dataUrl(url), ...descriptor].join(' ');
    }));
    return `srcset="${sources.join(', ')}"`;
  });
  return changed;
});
if (/<(?:iframe|object|embed)\b/i.test(html)) throw new Error('Standalone preview cannot include external frames or plugins.');
if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel=["']stylesheet|\b(?:src|poster)\s*=\s*["']\//i.test(html)) {
  throw new Error('A non-embedded asset remains; refusing to write an incomplete preview.');
}
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src https://www.google.com; object-src 'none'; base-uri 'none'; form-action 'none'";
html = html.replace(/<head\b[^>]*>/i, (head) => `${head}\n<meta name="site-mode" content="standalone-preview">\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
const fontLicences = new Set();
for (const filename of (await readdir(resolve(publicRoot, 'fonts'))).filter(name => /-LICENSE\.txt$/i.test(name)).sort()) {
  const licence = await readFile(resolve(publicRoot, 'fonts', filename), 'utf8');
  if (/<!--|-->/i.test(licence)) throw new Error(`Font licence cannot safely be embedded as an HTML comment: ${filename}`);
  fontLicences.add(licence.trim());
}
if (!fontLicences.size) throw new Error('Font licence files are required for the standalone preview.');
const fontNotices = [...fontLicences].map(licence => `<!-- Bundled font copyright and licence\n${licence}\n-->`).join('\n');
// Use a callback: JavaScript can contain literal $& and other replacement
// tokens, which String.replace would otherwise expand and corrupt the script.
html = html.replace('</body>', () => `<!-- Standalone visual preview. No server, payments, or message delivery. -->\n${fontNotices}\n<script>${javascript}</script>\n</body>`);
const emittedScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
if (emittedScripts.length !== 1) throw new Error('Preview must contain exactly one embedded application script.');
new Script(emittedScripts[0][1], { filename: 'Sahni-Astrologers.html:application' });

await mkdir(outputDirectory, { recursive: true });
const temporary = `${output}.${process.pid}.tmp`;
try {
  await writeFile(temporary, html);
  await rename(temporary, output);
  await copyFile(output, resolve(outputDirectory, 'Sahni-Astrologers-Final.html'));
} finally { await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; }); }
const archive = resolve(outputDirectory, 'Sahni-Astrologers-Website.zip');
const archiveTemporary = `${archive}.${process.pid}.tmp`;
try {
  const { mtime } = await stat(output);
  await writeFile(archiveTemporary, createPreviewArchive(html, { modifiedAt: mtime }));
  await rename(archiveTemporary, archive);
} finally { await unlink(archiveTemporary).catch((error) => { if (error.code !== 'ENOENT') throw error; }); }
console.log(`Standalone preview: ${relative(root, output)} (${Math.ceil(Buffer.byteLength(html) / 1024)} KiB; ${embedded.size} embedded assets).`);
console.log(`Download archive: ${relative(root, archive)} (extract, then open index.html in a full browser).`);
console.log('Open the HTML directly. Charts and navigation work offline; payments and messages require the hosted server.');
