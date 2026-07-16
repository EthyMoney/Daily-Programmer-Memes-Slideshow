const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const RENDERER_ROOT = path.join(PROJECT_ROOT, 'src', 'renderer');

module.exports = Object.freeze({
  ARCHIVE_ROOT: path.join(PROJECT_ROOT, 'memes-archive'),
  CONFIG_PATH: path.join(PROJECT_ROOT, 'config', 'config.json'),
  LOG_FILE: path.join(PROJECT_ROOT, 'electron-log.txt'),
  PRELOAD_FILE: path.join(PROJECT_ROOT, 'src', 'preload', 'index.js'),
  PROJECT_ROOT,
  RENDERER_INDEX_FILE: path.join(RENDERER_ROOT, 'index.html'),
  SPLASH_FILE: path.join(RENDERER_ROOT, 'splash.html'),
});
