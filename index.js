/* eslint-disable no-undef */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const logToFile = require('./logger');
const verifyTodaysImages = require('./scheduler');

let splashWindow;

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
    fullscreen: true,
    autoHideMenuBar: true,
    show: false,  // Hide the window until it's ready
  });

  mainWindow.loadFile('index.html');

  // Add this event listener
  mainWindow.once('ready-to-show', () => {
    // First, hide the splash screen
    splashWindow.close();

    // Then, show the main window
    mainWindow.show();
  });

  //mainWindow.webContents.openDevTools(); //opens chromium dev tools to see any issues in console
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false, // Remove window frame
    transparent: true, // Make window background transparent
  });

  splashWindow.loadFile('splash.html');
}


async function startup() {
  // Create and show the splash window immediately
  createSplashWindow();

  logToFile('Ensuring today\'s images are downloaded and ready...');

  // Then run the image download script
  await verifyTodaysImages();

  logToFile('Memes should now be ready, starting up!');

  // Once the images are ready, create the main window
  createMainWindow();
}

app.whenReady().then(startup);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

ipcMain.handle('read-dir', async (event, path) => {
  try {
    const files = await fs.readdir(path);
    return files;
  } catch (error) {
    logToFile('Error reading directory: ' + error);
    throw error;
  }
});
