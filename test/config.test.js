const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DEFAULT_CONFIG, loadConfig, validateConfig } = require('../src/main/config');

test('validateConfig accepts supported values', () => {
  const config = validateConfig({
    cycleTimeMinutes: 10,
    debugLogToFile: false,
    downloadSchedule: '30 7 * * *',
    imageCount: 20,
    maxConcurrentDownloads: 2,
    maxImageSizeMB: 25,
    timeZone: 'America/Chicago',
  });

  assert.equal(config.imageCount, 20);
  assert.equal(config.cycleTimeMinutes, 10);
  assert.equal(config.debugLogToFile, false);
  assert.equal(config.maxConcurrentDownloads, 2);
  assert.ok(Object.isFrozen(config));
});

test('validateConfig replaces unsafe values with defaults', () => {
  const warnings = [];
  const config = validateConfig({
    cycleTimeMinutes: 0,
    debugLogToFile: 'yes',
    imageCount: 1000,
    maxConcurrentDownloads: -1,
    timeZone: 'Not/AZone',
  }, warning => warnings.push(warning));

  assert.equal(config.imageCount, DEFAULT_CONFIG.imageCount);
  assert.equal(config.cycleTimeMinutes, DEFAULT_CONFIG.cycleTimeMinutes);
  assert.equal(config.debugLogToFile, DEFAULT_CONFIG.debugLogToFile);
  assert.equal(config.timeZone, DEFAULT_CONFIG.timeZone);
  assert.equal(warnings.length, 5);
});

test('loadConfig returns defaults for malformed JSON', t => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'memes-config-'));
  t.after(() => fs.rmSync(temporaryDirectory, { force: true, recursive: true }));
  const configPath = path.join(temporaryDirectory, 'config.json');
  fs.writeFileSync(configPath, '{not-json');
  const warnings = [];

  const config = loadConfig({ configPath, warn: warning => warnings.push(warning) });

  assert.deepEqual(config, DEFAULT_CONFIG);
  assert.equal(warnings.length, 1);
});
