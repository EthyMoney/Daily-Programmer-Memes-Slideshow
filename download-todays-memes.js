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

const subredditUrl = `https://www.reddit.com/r/ProgrammerHumor/hot/.json?limit=${postCount}`;
const todaysDate = new Date().toISOString().split('T')[0];
const subfolder = 'memes-archive';

// check for memes-archive subfolder, make if not present
if (!fs.existsSync(path.join(__dirname, subfolder))) {
  logToFile('made memes-archive folder')
  fs.mkdirSync(path.join(__dirname, subfolder));
}

const imagesFolderPath = path.join(__dirname, subfolder, todaysDate);

// check for today's dated images folder, make if not present
if (!fs.existsSync(imagesFolderPath)) {
  logToFile('made todays memes images folder')
  fs.mkdirSync(imagesFolderPath);
}

axios.get(subredditUrl)
  .then(response => {
    const posts = response.data.data.children;
    let imageUrls = posts.map(post => post.data.url)
      .filter(url => url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.gif'));

    // If there are more imageUrls than the desired amount, remove the excess ones (this is from the extra buffer we pulled earlier)
    if (imageUrls.length > desiredImageCount) {
      imageUrls = imageUrls.slice(0, desiredImageCount);
    }
    downloadImages(imageUrls);
  })
  .catch(error => logToFile('Error fetching subreddit data: ' + error));
  

function downloadImage(url, index, retryCount = 0) {
  const maxRetryCount = 5; // define the maximum number of retries
  return axios.get(url, { responseType: 'arraybuffer' })
    .then(response => {
      const imageType = url.split('.').pop();
      const fileName = `image-${index + 1}`;
      const filePath = path.join(imagesFolderPath, fileName + '.' + imageType);

      // Delete old file with the same name but different extension if exists
      const extensions = ['jpg', 'png', 'gif'];
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
    .then(() => logToFile('All images download attempts finished.'))
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
