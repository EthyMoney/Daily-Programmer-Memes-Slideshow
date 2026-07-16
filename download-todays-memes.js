const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { XMLParser } = require('fast-xml-parser');
const {
  ARCHIVE_ROOT,
  ensureArchiveRoot,
  listImagesForDate,
} = require('./archive');
const { loadConfig } = require('./config');
const { getDateKey } = require('./date-utils');
const logToFile = require('./logger');

const SUBREDDIT = 'ProgrammerHumor';
const CANDIDATE_BUFFER = 20;
const MAX_DOWNLOAD_RETRIES = 2;
const USER_AGENT = 'DailyProgrammerMemesSlideshow/1.0 (github.com/EthyMoney)';
const SUPPORTED_URL_PATTERN = /\.(?:gif|jpe?g|png|webp)(?:$|[?#])/i;
const IMAGE_CONTENT_TYPE_PATTERN = /^image\/(?:gif|jpeg|png|webp)$/i;

function invalidImageError(message) {
  const error = new Error(message);
  error.code = 'ERR_INVALID_IMAGE';
  return error;
}

function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textValue(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (value && typeof value['#text'] === 'string') {
    return value['#text'];
  }
  return '';
}

function normalizeImageUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }

  try {
    const decodedUrl = value.replaceAll('&amp;', '&').trim();
    const parsedUrl = new URL(decodedUrl);
    if (parsedUrl.protocol !== 'https:') {
      return '';
    }
    if (parsedUrl.hostname === 'preview.redd.it') {
      return `https://i.redd.it${parsedUrl.pathname}`;
    }
    return parsedUrl.toString();
  } catch {
    return '';
  }
}

function isSupportedImageUrl(url) {
  return typeof url === 'string' && SUPPORTED_URL_PATTERN.test(url);
}

function getEntryPermalink(entry) {
  const links = asArray(entry.link);
  const alternate = links.find(link => link && link.rel === 'alternate');
  const link = alternate || links[0];
  return typeof link === 'string' ? link : link?.href || '';
}

function extractImageUrlsFromHtml(html) {
  if (typeof html !== 'string') {
    return [];
  }

  const urls = [];
  const attributePattern = /\b(?:href|src)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attributePattern)) {
    const url = normalizeImageUrl(match[1]);
    if (isSupportedImageUrl(url)) {
      urls.push(url);
    }
  }
  return [...new Set(urls)];
}

function parseRssFeed(feedXml) {
  const parser = new XMLParser({
    attributeNamePrefix: '',
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: true,
    trimValues: true,
  });
  const parsed = parser.parse(feedXml);
  const entries = asArray(parsed?.feed?.entry);

  return entries.flatMap((entry, rank) => {
    const urls = extractImageUrlsFromHtml(textValue(entry.content));
    const preferredUrl = urls.find(url => new URL(url).hostname === 'i.redd.it') || urls[0];
    if (!preferredUrl) {
      return [];
    }

    return [{
      postId: textValue(entry.id),
      title: textValue(entry.title),
      permalink: getEntryPermalink(entry),
      published: textValue(entry.published || entry.updated),
      rank,
      url: preferredUrl,
    }];
  });
}

function parseJsonPosts(responseData) {
  const posts = responseData?.data?.children || [];
  return posts.flatMap((post, rank) => {
    const data = post?.data || {};
    const possibleUrls = [
      data.url_overridden_by_dest,
      data.url,
      data.preview?.images?.[0]?.source?.url,
    ].map(normalizeImageUrl);
    const url = possibleUrls.find(isSupportedImageUrl);
    if (!url) {
      return [];
    }

    return [{
      postId: data.name || data.id || '',
      title: data.title || '',
      permalink: data.permalink ? `https://www.reddit.com${data.permalink}` : '',
      published: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : '',
      rank,
      url,
    }];
  });
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(candidate => {
    if (!candidate.url || seen.has(candidate.url)) {
      return false;
    }
    seen.add(candidate.url);
    return true;
  });
}

async function fetchCandidates({ desiredCount, httpClient = axios, logger = logToFile }) {
  const postCount = desiredCount + CANDIDATE_BUFFER;
  const requestConfig = {
    timeout: 20000,
    headers: {
      'Accept': 'application/atom+xml, application/xml, text/xml',
      'User-Agent': USER_AGENT,
    },
  };
  const rssUrl = `https://www.reddit.com/r/${SUBREDDIT}/hot.rss?limit=${postCount}`;

  try {
    const response = await httpClient.get(rssUrl, requestConfig);
    const candidates = uniqueCandidates(parseRssFeed(response.data));
    if (candidates.length === 0) {
      throw new Error('RSS feed did not contain supported images.');
    }
    logger(`Fetched ${candidates.length} hot-post image candidates from Reddit RSS.`);
    return { candidates, source: 'reddit-rss' };
  } catch (rssError) {
    logger(`Reddit RSS request failed (${rssError.message}); trying JSON fallback.`);
  }

  const jsonUrls = [
    `https://www.reddit.com/r/${SUBREDDIT}/hot/.json?limit=${postCount}&raw_json=1`,
    `https://api.reddit.com/r/${SUBREDDIT}/hot?limit=${postCount}&raw_json=1`,
  ];
  let lastError;
  for (const url of jsonUrls) {
    try {
      const response = await httpClient.get(url, {
        timeout: 20000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
        },
      });
      const candidates = uniqueCandidates(parseJsonPosts(response.data));
      if (candidates.length > 0) {
        logger(`Fetched ${candidates.length} hot-post image candidates from Reddit JSON.`);
        return { candidates, source: 'reddit-json' };
      }
      lastError = new Error('Reddit JSON did not contain supported images.');
    } catch (error) {
      lastError = error;
      logger(`Reddit JSON request failed at ${url} (${error.message}).`);
    }
  }

  throw lastError || new Error('No supported Reddit images were found.');
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return null;
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpeg', mimeType: 'image/jpeg' };
  }
  const signature = buffer.subarray(0, 6).toString('ascii');
  if (signature === 'GIF87a' || signature === 'GIF89a') {
    return { extension: 'gif', mimeType: 'image/gif' };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  return null;
}

function isRetryableDownloadError(error) {
  if (error.code === 'ERR_INVALID_IMAGE' || error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED') {
    return false;
  }
  const status = error.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function writeResponseToFile(response, filePath, maxBytes) {
  const contentType = String(response.headers?.['content-type'] || '').split(';')[0].trim();
  if (contentType && contentType !== 'application/octet-stream' && !IMAGE_CONTENT_TYPE_PATTERN.test(contentType)) {
    throw invalidImageError(`Unexpected content type ${contentType}.`);
  }

  const contentLength = Number(response.headers?.['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw invalidImageError(`Image is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
  }

  let byteCount = 0;
  let header = Buffer.alloc(0);
  const hash = crypto.createHash('sha256');
  const inspectStream = new Transform({
    transform(chunk, encoding, callback) {
      byteCount += chunk.length;
      if (byteCount > maxBytes) {
        callback(invalidImageError(`Image exceeded the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`));
        return;
      }
      if (header.length < 16) {
        header = Buffer.concat([header, chunk.subarray(0, 16 - header.length)]);
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  const responseStream = Buffer.isBuffer(response.data) ? Readable.from([response.data]) : response.data;
  await pipeline(responseStream, inspectStream, fs.createWriteStream(filePath, { flags: 'wx' }));

  const imageType = detectImageType(header);
  if (!imageType) {
    throw invalidImageError('Downloaded file does not have a supported image signature.');
  }
  if (contentType && contentType !== 'application/octet-stream' && contentType !== imageType.mimeType) {
    throw invalidImageError(`Content type ${contentType} does not match ${imageType.mimeType}.`);
  }

  return {
    bytes: byteCount,
    extension: imageType.extension,
    sha256: hash.digest('hex'),
  };
}

async function downloadCandidate({
  candidate,
  candidateIndex,
  httpClient = axios,
  maxBytes,
  stagingDirectory,
}) {
  const temporaryPath = path.join(stagingDirectory, `.candidate-${candidateIndex}.part`);
  let lastError;

  for (let attempt = 0; attempt <= MAX_DOWNLOAD_RETRIES; attempt += 1) {
    await fs.promises.rm(temporaryPath, { force: true });
    try {
      const response = await httpClient.get(candidate.url, {
        headers: {
          'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8',
          'Referer': `https://www.reddit.com/r/${SUBREDDIT}/`,
          'User-Agent': USER_AGENT,
        },
        maxBodyLength: maxBytes,
        maxContentLength: maxBytes,
        responseType: 'stream',
        timeout: 20000,
      });
      const details = await writeResponseToFile(response, temporaryPath, maxBytes);
      return { ...candidate, ...details, temporaryPath };
    } catch (error) {
      lastError = error;
      await fs.promises.rm(temporaryPath, { force: true });
      if (attempt >= MAX_DOWNLOAD_RETRIES || !isRetryableDownloadError(error)) {
        break;
      }
      await wait((2 ** attempt) * 1000 + Math.floor(Math.random() * 250));
    }
  }

  throw lastError;
}

async function publishStagingDirectory({ archiveRoot, dateKey, stagingDirectory }) {
  const finalDirectory = path.join(archiveRoot, dateKey);
  const backupDirectory = path.join(archiveRoot, `.${dateKey}-${Date.now()}.backup`);
  let movedExistingDirectory = false;

  try {
    try {
      await fs.promises.rename(finalDirectory, backupDirectory);
      movedExistingDirectory = true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    await fs.promises.rename(stagingDirectory, finalDirectory);
  } catch (error) {
    if (movedExistingDirectory) {
      await fs.promises.rename(backupDirectory, finalDirectory).catch(() => {});
    }
    throw error;
  }

  if (movedExistingDirectory) {
    await fs.promises.rm(backupDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

async function recoverWorkingDirectories(archiveRoot, dateKey) {
  const entries = await fs.promises.readdir(archiveRoot, { withFileTypes: true });
  const prefix = `.${dateKey}-`;
  const backups = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix) && entry.name.endsWith('.backup'))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const finalDirectory = path.join(archiveRoot, dateKey);
  const finalExists = await fs.promises.access(finalDirectory).then(() => true).catch(() => false);

  if (!finalExists && backups.length > 0) {
    await fs.promises.rename(path.join(archiveRoot, backups.shift()), finalDirectory);
  }

  const staleDirectories = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))
    .map(entry => entry.name)
    .filter(name => !backups.includes(name) || finalExists);
  for (const name of new Set([...backups, ...staleDirectories])) {
    await fs.promises.rm(path.join(archiveRoot, name), { recursive: true, force: true });
  }
}

async function downloadTodaysMemes({
  archiveRoot = ARCHIVE_ROOT,
  config = loadConfig(),
  dateKey = getDateKey(new Date(), config.timeZone),
  httpClient = axios,
  logger = logToFile,
} = {}) {
  await ensureArchiveRoot(archiveRoot);
  await recoverWorkingDirectories(archiveRoot, dateKey);
  const stagingDirectory = await fs.promises.mkdtemp(path.join(archiveRoot, `.${dateKey}-`));
  const existingImages = await listImagesForDate(dateKey, archiveRoot);

  try {
    const { candidates, source } = await fetchCandidates({
      desiredCount: config.imageCount,
      httpClient,
      logger,
    });
    logger(`Downloading up to ${config.imageCount} validated images from ${candidates.length} candidates.`);

    const successes = [];
    const seenHashes = new Set();
    const maxBytes = config.maxImageSizeMB * 1024 * 1024;

    for (let start = 0; start < candidates.length && successes.length < config.imageCount;
      start += config.maxConcurrentDownloads) {
      const batch = candidates.slice(start, start + config.maxConcurrentDownloads);
      const results = await Promise.allSettled(batch.map((candidate, offset) => downloadCandidate({
        candidate,
        candidateIndex: start + offset,
        httpClient,
        maxBytes,
        stagingDirectory,
      })));

      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (result.status === 'rejected') {
          logger(`Skipped candidate ${start + index + 1}: ${result.reason.message}`);
          continue;
        }
        if (seenHashes.has(result.value.sha256) || successes.length >= config.imageCount) {
          await fs.promises.rm(result.value.temporaryPath, { force: true });
          continue;
        }
        seenHashes.add(result.value.sha256);
        successes.push(result.value);
      }
    }

    if (successes.length === 0) {
      throw new Error('No image candidates downloaded successfully.');
    }

    const manifestImages = [];
    for (let index = 0; index < successes.length; index += 1) {
      const image = successes[index];
      const fileName = `image-${index + 1}.${image.extension}`;
      await fs.promises.rename(image.temporaryPath, path.join(stagingDirectory, fileName));
      manifestImages.push({
        bytes: image.bytes,
        fileName,
        permalink: image.permalink,
        postId: image.postId,
        published: image.published,
        sha256: image.sha256,
        sourceUrl: image.url,
        title: image.title,
      });
    }

    const complete = successes.length >= config.imageCount;
    const manifest = {
      complete,
      createdAt: new Date().toISOString(),
      date: dateKey,
      desiredImageCount: config.imageCount,
      imageCount: successes.length,
      images: manifestImages,
      source,
      version: 1,
    };
    await fs.promises.writeFile(
      path.join(stagingDirectory, '.slideshow.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: 'wx' },
    );

    if (existingImages.length >= successes.length) {
      await fs.promises.rm(stagingDirectory, { recursive: true, force: true });
      const existingComplete = existingImages.length >= config.imageCount;
      logger(`Kept the existing ${dateKey} archive with ${existingImages.length} images.`);
      return {
        complete: existingComplete,
        dateKey,
        imageCount: existingImages.length,
        published: false,
        status: existingComplete ? 'complete' : 'partial',
      };
    }

    await publishStagingDirectory({ archiveRoot, dateKey, stagingDirectory });
    logger(`Published ${successes.length}/${config.imageCount} images for ${dateKey}${complete ? '.' : ' (partial set).'}`);
    return {
      complete,
      dateKey,
      imageCount: successes.length,
      published: true,
      status: complete ? 'complete' : 'partial',
    };
  } catch (error) {
    await fs.promises.rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

if (require.main === module) {
  downloadTodaysMemes()
    .then(result => {
      logToFile(`Download finished with status ${result.status} (${result.imageCount} images).`);
      if (!result.complete) {
        process.exitCode = 2;
      }
    })
    .catch(error => {
      logToFile(`Download failed: ${error.stack || error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  detectImageType,
  downloadTodaysMemes,
  extractImageUrlsFromHtml,
  fetchCandidates,
  isSupportedImageUrl,
  normalizeImageUrl,
  parseJsonPosts,
  parseRssFeed,
  writeResponseToFile,
};
