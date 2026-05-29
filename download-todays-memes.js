const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logToFile = require('./logger');

// Load the configuration values from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const desiredImageCount = config.imageCount;
const postCount = desiredImageCount + 15;
// the +15 is to grab a buffer of more posts than configured, because sometimes not all posts that come back contain images or images of the filtered types below
// this just increases the odds that we actually get the full amount of requested images from the current hottest posts

const subredditUrls = [
  `https://www.reddit.com/r/ProgrammerHumor/hot/.json?limit=${postCount}&raw_json=1`,
  `https://api.reddit.com/r/ProgrammerHumor/hot?limit=${postCount}&raw_json=1`
];
const subredditRssUrl = `https://www.reddit.com/r/ProgrammerHumor/hot.rss?limit=${postCount}`;
const redditRequestConfig = {
  timeout: 15000,
  headers: {
    // Reddit rejects many generic clients unless a descriptive user-agent is supplied.
    'User-Agent': 'DailyProgrammerMemesSlideshow/1.0 (github.com/EthyMoney)',
    'Accept': 'application/json'
  }
};
const todaysDate = new Date().toISOString().split('T')[0];
const subfolder = 'memes-archive';

// check for memes-archive subfolder, make if not present
if (!fs.existsSync(path.join(__dirname, subfolder))) {
  logToFile('made memes-archive folder');
  fs.mkdirSync(path.join(__dirname, subfolder));
}

const imagesFolderPath = path.join(__dirname, subfolder, todaysDate);

// check for today's dated images folder, make if not present
if (!fs.existsSync(imagesFolderPath)) {
  logToFile('made todays memes images folder');
  fs.mkdirSync(imagesFolderPath);
}

fetchImageUrls()
  .then(imageUrls => {
    logToFile(`Found ${imageUrls.length} images/gifs in the posts/feed`);
    // If there are more imageUrls than the desired amount, remove the excess ones (this is from the extra buffer we pulled earlier)
    if (imageUrls.length > desiredImageCount) {
      imageUrls = imageUrls.slice(0, desiredImageCount);
    }
    logToFile(`Downloading ${imageUrls.length} (configured quantity) images/gifs now...`);
    downloadImages(imageUrls);
  })
  .catch(error => {
    const status = error.response ? ` (status ${error.response.status})` : '';
    logToFile('Error fetching subreddit data' + status + ': ' + error.message);
    process.exit(1);
  });

async function fetchSubredditResponse() {
  let lastError;

  for (const url of subredditUrls) {
    try {
      return await axios.get(url, redditRequestConfig);
    } catch (error) {
      lastError = error;
      const status = error.response ? `status ${error.response.status}` : 'no status';
      logToFile(`Reddit request failed at ${url} (${status}), trying fallback...`);
    }
  }

  throw lastError;
}

async function fetchImageUrls() {
  try {
    const response = await fetchSubredditResponse();
    const posts = response.data.data.children;
    logToFile(`Fetched ${posts.length} posts from subreddit JSON endpoint`);
    return posts
      .map(post => normalizeImageUrl(post.data.url))
      .filter(isSupportedImageUrl);
  } catch {
    logToFile('JSON endpoints blocked or unavailable, trying RSS fallback...');
    return fetchImageUrlsFromRss();
  }
}

async function fetchImageUrlsFromRss() {
  const response = await axios.get(subredditRssUrl, {
    timeout: 15000,
    headers: {
      'User-Agent': redditRequestConfig.headers['User-Agent'],
      'Accept': 'application/atom+xml, application/xml, text/xml'
    }
  });

  const feedXml = response.data;
  // Only inspect individual <entry> blocks so feed-level icon/logo URLs are excluded.
  const entryRegex = /<entry\b[\s\S]*?<\/entry>/gi;
  const imageUrlRegex = /https:\/\/[\w.-]+\/[\w\-./%]+?\.(?:jpg|jpeg|png|gif)(?:\?[^"]*)?/gi;
  const entries = feedXml.match(entryRegex) || [];
  const rawMatches = entries.flatMap(entry => entry.match(imageUrlRegex) || []);
  const normalizedUrls = [...new Set(rawMatches.map(url => normalizeImageUrl(url)))];
  const imageUrls = normalizedUrls.filter(isSupportedImageUrl);
  logToFile(`Fetched ${imageUrls.length} image URLs from RSS fallback endpoint`);
  return imageUrls;
}

function normalizeImageUrl(url) {
  try {
    const decodedUrl = url.replace(/&amp;/g, '&');
    const parsedUrl = new URL(decodedUrl);

    if (parsedUrl.hostname === 'preview.redd.it') {
      return `https://i.redd.it${parsedUrl.pathname}`;
    }

    return decodedUrl;
  } catch {
    return url;
  }
}

function isSupportedImageUrl(url) {
  return /\.(jpg|jpeg|png|gif)(?:$|[?#])/i.test(url);
}

function getImageExtension(url) {
  const withoutQuery = url.split('?')[0].split('#')[0];
  return path.extname(withoutQuery).replace('.', '').toLowerCase();
}


function downloadImage(url, index, retryCount = 0) {
  const maxRetryCount = 5; // define the maximum number of retries
  return axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: {
      'User-Agent': redditRequestConfig.headers['User-Agent'],
      'Referer': 'https://www.reddit.com/r/ProgrammerHumor/'
    }
  })
    .then(response => {
      const imageType = getImageExtension(url);
      const fileName = `image-${index + 1}`;
      const filePath = path.join(imagesFolderPath, fileName + '.' + imageType);

      // Delete old file with the same name but different extension if exists
      const extensions = ['jpg', 'png', 'gif', 'jpeg'];
      extensions.forEach(ext => {
        if (ext !== imageType) {
          const oldFilePath = path.join(imagesFolderPath, fileName + '.' + ext);
          fs.unlink(oldFilePath, (err) => {
            if (err && err.code !== 'ENOENT') {
              // 'ENOENT' means file doesn't exist, ignore that error
              logToFile('Error deleting old image file: ' + err);
            }
          });
        }
      });

      // Write the new file
      fs.writeFile(filePath, Buffer.from(response.data), (error) => {
        if (error) {
          logToFile('Error writing image file: ' + error);
        } else {
          logToFile(`Image ${index + 1} saved as ${fileName}.${imageType}`);
        }
      });
    })
    .catch(error => {
      logToFile('Error downloading image: ' + error);
      if (retryCount < maxRetryCount) {
        logToFile(`Retry attempt ${retryCount + 1} for image ${index + 1}`);
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(downloadImage(url, index, retryCount + 1));
          }, 1000 * retryCount); // wait for retryCount seconds before retrying
        });
      } else {
        logToFile(`Max retries exceeded for image ${index + 1}`);
      }
    });
}

function downloadImages(imageUrls) {
  const downloadPromises = imageUrls.map((url, index) => downloadImage(url, index));
  Promise.allSettled(downloadPromises)
    .then(() => {
      setTimeout(() => {
        logToFile('All image download attempts finished.');
      }, 1000); // wait 1 second before logging to file to give the last image a chance to finish writing (promise resolves before the file is actually written)
    })
    .catch(error => {
      if (error instanceof AggregateError) {
        // Log the individual errors
        error.errors.forEach((err) => logToFile(err));
      } else {
        // Log any other type of error
        logToFile(error);
      }
    });
}
