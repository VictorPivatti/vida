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

  const jsResult = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/js/app.js')],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    target: ['es2020'],
    legalComments: 'none',
  });

  let html = fs.readFileSync(TEMPLATE, 'utf8');
  html = html.replace('<!-- BUILD:CSS -->', `<style>${cssResult.code}</style>`);
  html = html.replace('<!-- BUILD:JS -->', `<script>${jsResult.outputFiles[0].text}</script>`);

  fs.writeFileSync(OUT, html);
  console.log(`Built ${OUT} (${(html.length / 1024).toFixed(0)} KB)`);
}

build().catch(e => { console.error(e); process.exit(1); });
