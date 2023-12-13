/* eslint-disable no-undef */
const logToFile = window.electron.logToFile;
const config = window.electron.config;

logToFile('Renderer script started');

let imageDir = getImageDirectory();
let images = [];
let currentImage = 0;
let firstRun = true;
let imageInterval;
const cycleTimeMS = config.cycleTimeMinutes * 60000; // minutes to milliseconds for timeouts/intervals below

logToFile('Image directory: ' + imageDir);

function getImageDirectory() {
  let today = new Date();
  let yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let todayDir = `${window.electron.currentDir}/memes-archive/${today.toISOString().split('T')[0]}`;
  let yesterdayDir = `${window.electron.currentDir}/memes-archive/${yesterday.toISOString().split('T')[0]}`;

  return window.electron.exists(todayDir) ? todayDir : yesterdayDir;
}

function updateDirectoryAndReloadImages() {
  // first, update the image directory in case it's a new day (new folder name for the new date)
  imageDir = getImageDirectory();
  window.electron
    .readDir(imageDir)
    .then((files) => {
      logToFile('Files: ' + files);
      images = files.filter(
        (file) =>
          file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.gif')
      );

      if (images.length > 0) {
        if (firstRun) {
          logToFile('Displaying first image');
          displayImage();
          imageInterval = setInterval(displayImage, cycleTimeMS); // configured minutes
          firstRun = false;
        } else {
          if (images.length < config.imageCount) {
            // try reloading the directory and images in a few minutes if all images aren't present 
            // (was probably in the middle of downloading when this attempted to run to reload the images on new day)
            logToFile('Not all images present, checking again in 3 minutes...');
            setTimeout(updateDirectoryAndReloadImages, 180000); // retry in 3 minutes
            return;
          }
          logToFile('Images directory has been updated, new images loaded.');
        }
      } else {
        logToFile(`Retrying in ${config.cycleTimeMinutes} minutes...`);
        setTimeout(updateDirectoryAndReloadImages, cycleTimeMS); // retry in x minutes
      }
    })
    .catch((error) => {
      logToFile('Error reading image directory: ' + error);
      logToFile(`Retrying in ${config.cycleTimeMinutes} minutes...`);
      setTimeout(updateDirectoryAndReloadImages, cycleTimeMS); // retry in x minutes
    });
}

// Initial call to update directory and load images on first run
updateDirectoryAndReloadImages();

function displayImage() {
  // update images directory and reload images if it's a new day
  if (imageDir !== getImageDirectory()) {
    updateDirectoryAndReloadImages();
    return;
  }
  logToFile('Current image index: ' + currentImage);

  const img = document.getElementById('imageContainer');
  let imagePath = `file://${imageDir}/${images[currentImage]}`;
  img.src = imagePath;

  img.onload = () => {
    logToFile('Image loaded');
    currentImage = (currentImage + 1) % images.length;
  };

  img.onerror = (error) => {
    logToFile('Error loading image: ' + error);
    logToFile('Image path: ' + imagePath);
    // if there's an error loading the image, attempt to reload the images and directory and try again
    logToFile('Attempting to reload images and directory...');
    updateDirectoryAndReloadImages();
  };
}


// Click event listener (for skipping to next image early)
document.getElementById('imageContainer').addEventListener('click', () => {
  logToFile('screen clicked, skipping to next image!');
  clearInterval(imageInterval); // clear the existing interval
  displayImage();
  imageInterval = setInterval(displayImage, cycleTimeMS); // reset interval timer on screen click
});


// The following is to hide the mouse cursor so it doesn't sit on the screen over the memes
let cursorTimeout;

function hideCursor() {
  document.body.style.cursor = 'none';
}

document.onmousemove = function () {
  document.body.style.cursor = 'auto';
  clearTimeout(cursorTimeout);
  cursorTimeout = setTimeout(hideCursor, 3000); // hides the cursor after 3 seconds of inactivity
};

// Call this once to start the behavior
cursorTimeout = setTimeout(hideCursor, 3000);
