const logToFile = window.electron.logToFile;
const config = window.electron.config;

logToFile('Renderer script started');

let imageDir = getImageDirectory();
let images = [];
let currentImage = 0;
let firstRun = true;
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
          setInterval(displayImage, cycleTimeMS); // configured minutes
          firstRun = false;
        } else {
          logToFile('Images directory has been updated, new images loaded.')
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

updateDirectoryAndReloadImages();

function displayImage() {
  // update image directory in case it's a new day (new folder name for the new date)
  imageDir = getImageDirectory();
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
  };
}


// Click event listener (for skipping to next image early)
document.getElementById('imageContainer').addEventListener('click', () => {
  logToFile('screen clicked, skipping to next image!')
  displayImage();
});


// The following is to hide the mouse cursor so it doesn't sit on the screen over the memes
let cursorTimeout;

function hideCursor() {
  document.body.style.cursor = 'none';
}

window.onmousemove = function () {
  document.body.style.cursor = 'auto';
  clearTimeout(cursorTimeout);
  cursorTimeout = setTimeout(hideCursor, 3000); // hides the cursor after 3 seconds of inactivity
}

// Call this once to start the behavior
cursorTimeout = setTimeout(hideCursor, 3000);
