const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
require('./scheduler');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    fullscreen: true,
    autoHideMenuBar: true,
  });

  mainWindow.loadFile('index.html');
  //mainWindow.webContents.openDevTools(); //opens dev tools to see issues in console
}

async function startup() {
  // wait 5 seconds before creating window to allow time for ensuring today's images are downloaded
  console.log('Ensuring today\'s images are downloaded and ready...\n')
  await sleep(5000).then(() => {
    console.log('Memes should be ready, starting up!')
    app.whenReady().then(createWindow);
  });
}

startup();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('read-dir', async (event, path) => {
  try {
    const files = await fs.readdir(path);
    return files;
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
