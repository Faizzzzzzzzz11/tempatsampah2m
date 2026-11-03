import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourceFile = path.join(rootDir, 'dist', 'index.source.html');
const targetFile = path.join(rootDir, 'index.html');
const distTargetFile = path.join(rootDir, 'dist', 'index.html');

if (!fs.existsSync(sourceFile)) {
  console.error('Source file not found:', sourceFile);
  process.exit(1);
}

let html = fs.readFileSync(sourceFile, 'utf8');

// 1. Inline Leaflet CSS if available
const leafletCssPath = path.join(rootDir, 'node_modules', 'leaflet', 'dist', 'leaflet.css');
if (fs.existsSync(leafletCssPath)) {
  const leafletCss = fs.readFileSync(leafletCssPath, 'utf8');
  html = html.replace(/<link rel="stylesheet" href="https:\/\/unpkg\.com\/leaflet[^"]*"[^>]*>/i, `<style>/* Inlined Leaflet CSS */\n${leafletCss}\n</style>`);
}

// 2. Remove modulepreload polyfill which tries to fetch on file://
html = html.replace(/\(function\(\)\{let e=document\.createElement\(`link`\)[\s\S]*?fetch\(e\.href,n\)\}\}\)\(\);/g, '');

// 3. Convert manifest link to inline data URI
const manifestPath = path.join(rootDir, 'public', 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifestData = fs.readFileSync(manifestPath, 'utf8');
  const base64Manifest = Buffer.from(manifestData).toString('base64');
  html = html.replace(/<link rel="manifest" href="[^"]*"\s*\/?>/g, `<link rel="manifest" href="data:application/manifest+json;base64,${base64Manifest}" />`);
}

// 4. Extract the main script from <head> and place it at the very bottom of <body> (after <div id="root"></div>)
// Standardize to <script> (classic script, non-module) so it works seamlessly over file:// protocol
const scriptRegex = /<script(?:\s+type="module")?(?:\s+crossorigin)?\s*>([\s\S]*?)<\/script>/i;
const scriptMatch = html.match(scriptRegex);

if (scriptMatch) {
  const scriptContent = scriptMatch[1];
  // Remove script from head
  html = html.replace(scriptMatch[0], '');
  // Insert at the bottom of body, after <div id="root"></div>
  html = html.replace(/<\/body>/i, `<script>\n${scriptContent}\n</script>\n</body>`);
}

// 5. Save to both root index.html and dist/index.html
fs.writeFileSync(targetFile, html, 'utf8');
fs.writeFileSync(distTargetFile, html, 'utf8');

console.log('✅ Standalone single-file index.html created successfully at:', targetFile);
