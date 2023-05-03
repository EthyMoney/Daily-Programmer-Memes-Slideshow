const logToFile = window.electron.logToFile;

logToFile('Renderer script started');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imageDir = `${window.electron.currentDir}/memes-archive/${new Date().toISOString().split('T')[0]}`;
let images = [];
let currentImage = 0;

logToFile('Image directory: ' + imageDir);

window.electron
  .readDir(imageDir)
  .then((files) => {
    logToFile('Files: ' + files);
    images = files.filter(
      (file) =>
        file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.gif')
    );

    if (images.length > 0) {
      logToFile('Displaying first image');
      displayImage();
      setInterval(displayImage, 300000); // 5 minutes
    } else {
      logToFile('No images found.');
    }
  })
  .catch((error) => logToFile('Error reading image directory: ' + error));

function displayImage() {
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
