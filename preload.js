const { contextBridge, ipcRenderer } = require('electron');
const logToFile = require('./logger');
const fs = require('fs');

contextBridge.exposeInMainWorld('electron', {
  readDir: (path) => ipcRenderer.invoke('read-dir', path),
  exists: (path) => fs.existsSync(path),
  currentDir: __dirname,
  logToFile
});
