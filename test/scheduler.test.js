const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createScheduler } = require('../src/main/scheduler');

function testConfig() {
  return {
    cycleTimeMinutes: 5,
    debugLogToFile: false,
    downloadSchedule: '0 8 * * *',
    imageCount: 2,
    maxConcurrentDownloads: 2,
    maxImageSizeMB: 1,
    timeZone: 'America/Chicago',
  };
}

function createTemporaryArchive(t) {
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'memes-scheduler-'));
  t.after(() => fs.rmSync(archiveRoot, { force: true, recursive: true }));
  return archiveRoot;
}

test('scheduler failure leaves older usable archives available', async t => {
  const archiveRoot = createTemporaryArchive(t);
  const oldDirectory = path.join(archiveRoot, '2026-07-15');
  fs.mkdirSync(oldDirectory);
  fs.writeFileSync(path.join(oldDirectory, 'image-1.png'), 'old');
  const statuses = [];
  const scheduler = createScheduler({
    archiveRoot,
    config: testConfig(),
    downloader: async () => {
      throw new Error('offline');
    },
    logger: () => {},
    now: () => new Date('2026-07-16T15:00:00Z'),
    onStatusChanged: status => statuses.push(status),
  });

  const result = await scheduler.verifyTodaysImages({ reason: 'test' });

  assert.equal(result.status, 'failed');
  assert.equal(fs.readFileSync(path.join(oldDirectory, 'image-1.png'), 'utf8'), 'old');
  assert.deepEqual(statuses.map(status => status.state), ['checking', 'downloading', 'failed']);
  assert.equal(statuses.at(-1).retryWithinMinutes, 30);
});

test('scheduler joins overlapping verification requests', async t => {
  const archiveRoot = createTemporaryArchive(t);
  let downloadCalls = 0;
  let archiveUpdateCalls = 0;
  let finishDownload;
  const downloadPromise = new Promise(resolve => {
    finishDownload = resolve;
  });
  const scheduler = createScheduler({
    archiveRoot,
    config: testConfig(),
    downloader: async () => {
      downloadCalls += 1;
      await downloadPromise;
      return { complete: true, imageCount: 2, published: true, status: 'complete' };
    },
    logger: () => {},
    now: () => new Date('2026-07-16T15:00:00Z'),
    onArchiveUpdated: () => {
      archiveUpdateCalls += 1;
    },
  });

  const first = scheduler.verifyTodaysImages({ reason: 'first' });
  const second = scheduler.verifyTodaysImages({ reason: 'second' });
  finishDownload();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(downloadCalls, 1);
  assert.equal(archiveUpdateCalls, 1);
  assert.equal(firstResult.status, 'complete');
  assert.equal(secondResult.status, 'complete');
  assert.equal(scheduler.getStatus().state, 'current');
});

test('scheduler reports an existing complete archive as current', async t => {
  const archiveRoot = createTemporaryArchive(t);
  const dateDirectory = path.join(archiveRoot, '2026-07-16');
  fs.mkdirSync(dateDirectory);
  fs.writeFileSync(path.join(dateDirectory, 'image-1.png'), 'one');
  fs.writeFileSync(path.join(dateDirectory, 'image-2.png'), 'two');
  let downloadCalls = 0;
  const scheduler = createScheduler({
    archiveRoot,
    config: testConfig(),
    downloader: async () => {
      downloadCalls += 1;
    },
    logger: () => {},
    now: () => new Date('2026-07-16T15:00:00Z'),
  });

  const result = await scheduler.verifyTodaysImages({ reason: 'test' });

  assert.equal(result.status, 'complete');
  assert.equal(downloadCalls, 0);
  assert.equal(scheduler.getStatus().state, 'current');
  assert.equal(scheduler.getStatus().imageCount, 2);
});
