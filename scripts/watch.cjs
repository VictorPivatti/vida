'use strict';
const { execSync, watch } = require('fs');
const run = () => { try { execSync('npm test', { stdio: 'inherit' }); } catch (_) {} };
run();
watch('.', { recursive: true }, (t, f) => {
  if (f && (f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.mjs') || f.endsWith('.html'))) run();
});
