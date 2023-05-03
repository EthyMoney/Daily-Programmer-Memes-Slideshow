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


app.whenReady().then(createWindow);

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
