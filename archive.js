const fs = require('fs');
const path = require('path');
const { isDateKey } = require('./date-utils');

const ARCHIVE_ROOT = path.join(__dirname, 'memes-archive');
const SUPPORTED_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);

function imageNumber(fileName) {
  const match = /^image-(\d+)\.[a-z0-9]+$/i.exec(fileName);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function sortImageNames(left, right) {
  const difference = imageNumber(left) - imageNumber(right);
  return difference || left.localeCompare(right);
}

function isSupportedImageName(fileName) {
  return /^image-\d+\.[a-z0-9]+$/i.test(fileName) &&
    SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

async function ensureArchiveRoot(archiveRoot = ARCHIVE_ROOT) {
  await fs.promises.mkdir(archiveRoot, { recursive: true });
}

async function listImagesForDate(dateKey, archiveRoot = ARCHIVE_ROOT) {
  if (!isDateKey(dateKey)) {
    return [];
  }

  try {
    const directory = path.join(archiveRoot, dateKey);
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && isSupportedImageName(entry.name))
      .map(entry => entry.name)
      .sort(sortImageNames);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function findNewestUsableArchive(archiveRoot = ARCHIVE_ROOT) {
  await ensureArchiveRoot(archiveRoot);
  const entries = await fs.promises.readdir(archiveRoot, { withFileTypes: true });
  const dateKeys = entries
    .filter(entry => entry.isDirectory() && isDateKey(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => right.localeCompare(left));

  for (const dateKey of dateKeys) {
    const images = await listImagesForDate(dateKey, archiveRoot);
    if (images.length > 0) {
      const stats = await fs.promises.stat(path.join(archiveRoot, dateKey));
      return { dateKey, images, revision: Math.trunc(stats.mtimeMs) };
    }
  }

  return null;
}

function createMemeUrl(dateKey, fileName, revision = '') {
  if (!isDateKey(dateKey) || !isSupportedImageName(fileName) || path.basename(fileName) !== fileName) {
    throw new Error('Invalid archive image path.');
  }
  const revisionQuery = revision ? `?v=${encodeURIComponent(revision)}` : '';
  return `meme://archive/${dateKey}/${encodeURIComponent(fileName)}${revisionQuery}`;
}

async function resolveMemeUrl(url, archiveRoot = ARCHIVE_ROOT) {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parsed.protocol !== 'meme:' || parsed.hostname !== 'archive' || pathParts.length !== 2) {
    throw new Error('Invalid meme URL.');
  }

  const [dateKey, fileName] = pathParts;
  if (!isDateKey(dateKey) || !isSupportedImageName(fileName) || path.basename(fileName) !== fileName) {
    throw new Error('Invalid meme URL path.');
  }

  const archivePath = path.resolve(archiveRoot);
  const requestedPath = path.resolve(archiveRoot, dateKey, fileName);
  if (!requestedPath.startsWith(`${archivePath}${path.sep}`)) {
    throw new Error('Meme path escapes the archive.');
  }

  const [realArchivePath, realRequestedPath, stats] = await Promise.all([
    fs.promises.realpath(archiveRoot),
    fs.promises.realpath(requestedPath),
    fs.promises.stat(requestedPath),
  ]);
  if (!stats.isFile() || !realRequestedPath.startsWith(`${realArchivePath}${path.sep}`)) {
    throw new Error('Meme path is not a regular archive file.');
  }

  return realRequestedPath;
}

module.exports = {
  ARCHIVE_ROOT,
  SUPPORTED_EXTENSIONS,
  createMemeUrl,
  ensureArchiveRoot,
  findNewestUsableArchive,
  isSupportedImageName,
  listImagesForDate,
  resolveMemeUrl,
  sortImageNames,
};
