const { contextBridge, ipcRenderer } = require('electron');
const logToFile = require('./logger');
const fs = require('fs');
// Load the configuration values from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// report the loaded configuration
logToFile('Your config is as follows:' +
  '\n                          - Number of images: ' + config.imageCount +
  '\n                          - Cycle time: ' +
  config.cycleTimeMinutes + ' minutes');

contextBridge.exposeInMainWorld('electron', {
  readDir: (path) => ipcRenderer.invoke('read-dir', path),
  exists: (path) => fs.existsSync(path),
  currentDir: __dirname,
  logToFile,
  config
});
