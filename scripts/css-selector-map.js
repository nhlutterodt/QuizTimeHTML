// scripts/css-selector-map.js
// Scans all .css files (excluding node_modules) and produces a JSON map of selector -> files and counts

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const postcss = require('postcss');
const safeParser = require('postcss-safe-parser');

const workspaceRoot = path.resolve(__dirname, '..');
const outFile = path.join(__dirname, 'css-selector-map.json');

function collectCssFiles() {
  return glob.sync('**/*.css', { cwd: workspaceRoot, absolute: true, ignore: ['**/node_modules/**', '**/.git/**'] });
}

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    const root = postcss.parse(content, { from: filePath, parser: safeParser });
    const selectors = [];
    root.walkRules(rule => {
      // skip keyframes selectors like 'from'/'to'
      if (!rule.selector) return;
      // split comma-separated selectors
      rule.selector.split(',').forEach(s => {
        const sel = s.trim();
        if (sel) selectors.push(sel);
      });
    });
    return selectors;
  } catch (err) {
    console.error('Parse error in', filePath, err && err.message);
    return [];
  }
}

function buildMap(files) {
  const map = Object.create(null);
  for (const f of files) {
    const selectors = parseFile(f);
    const relative = path.relative(workspaceRoot, f);
    for (const sel of selectors) {
      if (!map[sel]) map[sel] = { count: 0, files: new Set() };
      map[sel].count += 1;
      map[sel].files.add(relative);
    }
  }
  // convert sets to arrays
  const out = Object.create(null);
  Object.keys(map).forEach(sel => {
    out[sel] = { count: map[sel].count, files: Array.from(map[sel].files).sort() };
  });
  return out;
}

function main() {
  const files = collectCssFiles();
  console.log('Found', files.length, 'CSS files');
  const map = buildMap(files);
  fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), filesScanned: files.length, map }, null, 2), 'utf8');
  console.log('Wrote', outFile);
}

main();
