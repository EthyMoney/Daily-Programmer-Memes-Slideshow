const { contextBridge, ipcRenderer } = require('electron');
const logToFile = require('./logger');

contextBridge.exposeInMainWorld('electron', {
  readDir: async (path) => {
    return await ipcRenderer.invoke('read-dir', path);
  },
  currentDir: __dirname,
  logToFile
});
