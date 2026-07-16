const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  detectImageType,
  downloadTodaysMemes,
  parseRssFeed,
} = require('../download-todays-memes');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]);

function rssFeed(urls) {
  const entries = urls.map((url, index) => `
    <entry>
      <content type="html">&lt;a href=&quot;${url}&quot;&gt;[link]&lt;/a&gt;</content>
      <id>post-${index + 1}</id>
      <link href="https://www.reddit.com/r/ProgrammerHumor/comments/post-${index + 1}" />
      <published>2026-07-16T0${index}:00:00Z</published>
      <title>Post ${index + 1}</title>
    </entry>`).join('');
  return `<?xml version="1.0"?><feed>${entries}</feed>`;
}

function testConfig(imageCount) {
  return {
    cycleTimeMinutes: 5,
    debugLogToFile: false,
    downloadSchedule: '0 8 * * *',
    imageCount,
    maxConcurrentDownloads: 2,
    maxImageSizeMB: 1,
    timeZone: 'America/Chicago',
  };
}

function createTemporaryArchive(t) {
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'memes-download-'));
  t.after(() => fs.rmSync(archiveRoot, { force: true, recursive: true }));
  return archiveRoot;
}

test('parseRssFeed returns one direct image candidate per Atom entry', () => {
  const feed = rssFeed([
    'https://i.redd.it/first.png',
    'https://preview.redd.it/second.jpeg?width=640&amp;auto=webp',
  ]);

  const candidates = parseRssFeed(feed);

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].url, 'https://i.redd.it/first.png');
  assert.equal(candidates[1].url, 'https://i.redd.it/second.jpeg');
  assert.equal(candidates[0].title, 'Post 1');
});

test('detectImageType recognizes supported file signatures', () => {
  assert.equal(detectImageType(PNG).extension, 'png');
  assert.equal(detectImageType(JPEG).extension, 'jpeg');
  assert.equal(detectImageType(Buffer.from('GIF89a')).extension, 'gif');
  assert.equal(detectImageType(Buffer.from('not an image')), null);
});

test('downloadTodaysMemes fills failed and duplicate candidates from the buffer', async t => {
  const archiveRoot = createTemporaryArchive(t);
  const urls = [
    'https://i.redd.it/one.png',
    'https://i.redd.it/blocked.png',
    'https://i.redd.it/not-an-image.png',
    'https://i.redd.it/duplicate.png',
    'https://i.redd.it/four.jpeg',
  ];
  let invalidImageRequests = 0;
  const httpClient = {
    async get(url) {
      if (url.includes('.rss')) {
        return { data: rssFeed(urls) };
      }
      if (url.includes('blocked')) {
        const error = new Error('Request failed with status code 403');
        error.response = { status: 403 };
        throw error;
      }
      if (url.includes('not-an-image')) {
        invalidImageRequests += 1;
        return { data: Buffer.from('<html>nope</html>'), headers: { 'content-type': 'text/html' } };
      }
      const jpeg = url.endsWith('.jpeg');
      return {
        data: jpeg ? JPEG : PNG,
        headers: { 'content-type': jpeg ? 'image/jpeg' : 'image/png' },
      };
    },
  };

  const result = await downloadTodaysMemes({
    archiveRoot,
    config: testConfig(2),
    dateKey: '2026-07-16',
    httpClient,
    logger: () => {},
  });

  assert.equal(result.status, 'complete');
  assert.equal(result.imageCount, 2);
  assert.equal(invalidImageRequests, 1);
  assert.deepEqual(
    fs.readdirSync(path.join(archiveRoot, '2026-07-16')).sort(),
    ['.slideshow.json', 'image-1.png', 'image-2.jpeg'],
  );
  const manifest = JSON.parse(fs.readFileSync(
    path.join(archiveRoot, '2026-07-16', '.slideshow.json'),
    'utf8',
  ));
  assert.equal(manifest.complete, true);
  assert.equal(manifest.images[1].sourceUrl, urls[4]);
});

test('downloadTodaysMemes reports and publishes a usable partial set', async t => {
  const archiveRoot = createTemporaryArchive(t);
  const httpClient = {
    async get(url) {
      if (url.includes('.rss')) {
        return { data: rssFeed(['https://i.redd.it/only.png']) };
      }
      return { data: PNG, headers: { 'content-type': 'image/png' } };
    },
  };

  const result = await downloadTodaysMemes({
    archiveRoot,
    config: testConfig(3),
    dateKey: '2026-07-16',
    httpClient,
    logger: () => {},
  });

  assert.equal(result.status, 'partial');
  assert.equal(result.imageCount, 1);
  assert.equal(fs.existsSync(path.join(archiveRoot, '2026-07-16', 'image-1.png')), true);
  assert.equal(fs.readdirSync(archiveRoot).some(name => name.startsWith('.2026-07-16-')), false);
});
