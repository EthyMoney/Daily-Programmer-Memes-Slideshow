const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createMemeUrl,
  findNewestUsableArchive,
  listImagesForDate,
  resolveMemeUrl,
} = require('../src/main/archive');

function createTemporaryArchive(t) {
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'memes-archive-'));
  t.after(() => fs.rmSync(archiveRoot, { force: true, recursive: true }));
  return archiveRoot;
}

test('findNewestUsableArchive skips empty dates and sorts image numbers', async t => {
  const archiveRoot = createTemporaryArchive(t);
  fs.mkdirSync(path.join(archiveRoot, '2026-07-16'));
  fs.mkdirSync(path.join(archiveRoot, '2026-07-15'));
  fs.writeFileSync(path.join(archiveRoot, '2026-07-15', 'image-10.jpeg'), 'ten');
  fs.writeFileSync(path.join(archiveRoot, '2026-07-15', 'image-2.png'), 'two');
  fs.writeFileSync(path.join(archiveRoot, '2026-07-15', 'notes.txt'), 'ignored');

  const archive = await findNewestUsableArchive(archiveRoot);

  assert.equal(archive.dateKey, '2026-07-15');
  assert.deepEqual(archive.images, ['image-2.png', 'image-10.jpeg']);
  assert.equal(typeof archive.revision, 'number');
});

test('archive URLs resolve only regular files below the archive root', async t => {
  const archiveRoot = createTemporaryArchive(t);
  const dateDirectory = path.join(archiveRoot, '2026-07-16');
  fs.mkdirSync(dateDirectory);
  const imagePath = path.join(dateDirectory, 'image-1.png');
  fs.writeFileSync(imagePath, 'image');

  const url = createMemeUrl('2026-07-16', 'image-1.png', 123);
  assert.equal(await resolveMemeUrl(url, archiveRoot), imagePath);
  await assert.rejects(resolveMemeUrl('meme://archive/../../etc/passwd', archiveRoot));
  assert.throws(() => createMemeUrl('2026-07-16', '../image-1.png'));
});

test('listImagesForDate ignores symlinks and unrelated files', async t => {
  const archiveRoot = createTemporaryArchive(t);
  const dateDirectory = path.join(archiveRoot, '2026-07-16');
  fs.mkdirSync(dateDirectory);
  fs.writeFileSync(path.join(dateDirectory, 'image-1.webp'), 'image');
  fs.writeFileSync(path.join(dateDirectory, '.slideshow.json'), '{}');
  fs.symlinkSync('/etc/passwd', path.join(dateDirectory, 'image-2.png'));

  assert.deepEqual(await listImagesForDate('2026-07-16', archiveRoot), ['image-1.webp']);
});
