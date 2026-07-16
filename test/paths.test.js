const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const paths = require('../src/main/paths');

test('runtime paths remain anchored at the project root', () => {
  const projectRoot = path.resolve(__dirname, '..');
  assert.equal(paths.PROJECT_ROOT, projectRoot);
  assert.equal(paths.ARCHIVE_ROOT, path.join(projectRoot, 'memes-archive'));
  assert.equal(paths.CONFIG_PATH, path.join(projectRoot, 'config', 'config.json'));
  assert.equal(paths.LOG_FILE, path.join(projectRoot, 'electron-log.txt'));
});

test('Electron entry files exist in their conventional directories', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(paths.PROJECT_ROOT, 'package.json'), 'utf8'));
  assert.equal(packageJson.main, 'src/main/index.js');
  assert.equal(fs.existsSync(paths.PRELOAD_FILE), true);
  assert.equal(fs.existsSync(paths.RENDERER_INDEX_FILE), true);
  assert.equal(fs.existsSync(paths.SPLASH_FILE), true);
});
