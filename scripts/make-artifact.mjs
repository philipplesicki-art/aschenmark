// Baut eine einzelne HTML-Datei (alles eingebettet), z. B. zum Veröffentlichen als Artifact oder zum Teilen.
// Aufruf: npm run artifact  ->  dist-single/aschenmark.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist-single', { recursive: true, force: true });
mkdirSync('dist-single', { recursive: true });
await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020',
  outfile: 'dist-single/bundle.js', loader: { '.css': 'css' }, logLevel: 'warning'
});
const js = readFileSync('dist-single/bundle.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist-single/bundle.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
const fonts = html.match(/<link rel="stylesheet"[^>]*>/)[0];
const out = `<title>Aschenmark 2</title>\n${fonts}\n<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`;
writeFileSync('dist-single/aschenmark.html', out);
console.log('dist-single/aschenmark.html', Math.round(out.length / 1024) + ' kB');
