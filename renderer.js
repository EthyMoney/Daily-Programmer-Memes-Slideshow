const logToFile = window.electron.logToFile;

logToFile('Renderer script started');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let imageDir = getImageDirectory();
let images = [];
let currentImage = 0;
let firstRun = true;

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
          setInterval(displayImage, 300000); // 5 minutes
          firstRun = false;
        } else {
          logToFile('Images directory has been updated, new images loaded.')
        }
      } else {
        logToFile('No images found. Retrying in 5 minutes...');
        setTimeout(updateDirectoryAndReloadImages, 300000); // retry in 5 minutes
      }
    })
    .catch((error) => {
      logToFile('Error reading image directory: ' + error);
      logToFile('Retrying in 5 minutes...');
      setTimeout(updateDirectoryAndReloadImages, 300000); // retry in 5 minutes
    });
}

updateDirectoryAndReloadImages();

function displayImage() {
  // update image directory in case it's a new day (new folder name for the new date)
  imageDir = getImageDirectory();
  logToFile('Current image index: ' + currentImage);
  const img = new Image();
  img.src = `file://${imageDir}/${images[currentImage]}`;

  img.onload = () => {
    logToFile('Image loaded');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const imgAspectRatio = img.width / img.height;
    let newWidth = canvas.width;
    let newHeight = newWidth / imgAspectRatio;

    if (newHeight > canvas.height) {
      newHeight = canvas.height;
      newWidth = newHeight * imgAspectRatio;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      (canvas.width - newWidth) / 2,
      (canvas.height - newHeight) / 2,
      newWidth,
      newHeight
    );

    currentImage = (currentImage + 1) % images.length;
  };

  img.onerror = (error) => {
    logToFile('Error loading image: ' + error);
  };
}

// Click event listener (for skipping to next image early)
canvas.addEventListener('click', () => {
  logToFile('screen clicked, skipping to next image!')
  displayImage();
});
