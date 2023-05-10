const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logToFile = require('./logger');

// Load the configuration values from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const imageCount = config.imageCount;

const subredditUrl = `https://www.reddit.com/r/ProgrammerHumor/hot/.json?limit=${imageCount}`;
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
    const imageUrls = posts.map(post => post.data.url)
      .filter(url => url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.gif'));

    downloadImages(imageUrls);
  })
  .catch(error => logToFile('Error fetching subreddit data: ' + error));

function downloadImages(imageUrls) {
  imageUrls.forEach((url, index) => {
    axios.get(url, { responseType: 'arraybuffer' })
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
      .catch(error => logToFile('Error downloading image: ' + error));
  });
}
