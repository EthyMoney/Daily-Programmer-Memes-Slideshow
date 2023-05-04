const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logToFile = require('./logger');

const subredditUrl = 'https://www.reddit.com/r/ProgrammerHumor/hot/.json?limit=12';
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
        const fileName = `image-${index + 1}.${imageType}`;
        const filePath = path.join(imagesFolderPath, fileName);

        fs.writeFile(filePath, Buffer.from(response.data), (error) => {
          if (error) {
            logToFile('Error writing image file: ' + error);
          } else {
            logToFile(`Image ${index + 1} saved as ${fileName}`);
          }
        });
      })
      .catch(error => logToFile('Error downloading image: ' + error));
  });
}
