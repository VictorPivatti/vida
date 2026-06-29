'use strict';
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'src/index.template.html');
const OUT = path.join(ROOT, 'index.html');

async function build() {
  const cssPath = path.join(ROOT, 'src/styles/main.css');
  const cssIn = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  const cssResult = await esbuild.transform(cssIn, { loader: 'css', minify: true });

  // Build worker bundle first so its code can be injected into the main bundle.
  // The worker uses its own consistent minified namespace, avoiding the naming
  // mismatch that breaks Function.toString()-based serialization.
  const workerResult = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/js/workers/hist-worker-entry.js')],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    target: ['es2020'],
    legalComments: 'none',
  });
  const XLSX_CDN = "importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');\n";
  const workerCode = XLSX_CDN + workerResult.outputFiles[0].text;

  const jsResult = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/js/app.js')],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    target: ['es2020'],
    legalComments: 'none',
    define: {
      __HIST_WORKER_CODE__: JSON.stringify(workerCode),
    },
  });

  let html = fs.readFileSync(TEMPLATE, 'utf8');
  // Use function callbacks so $& / $' / $` special sequences in the
  // minified output are never interpreted as replacement patterns.
  html = html.replace('<!-- BUILD:CSS -->', () => `<style>${cssResult.code}</style>`);
  html = html.replace('<!-- BUILD:JS -->', () => `<script>${jsResult.outputFiles[0].text}</script>`);

  fs.writeFileSync(OUT, html);
  console.log(`Built ${OUT} (${(html.length / 1024).toFixed(0)} KB)`);
}

build().catch(e => { console.error(e); process.exit(1); });
