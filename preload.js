const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slideshow', {
  getState: () => ipcRenderer.invoke('slideshow:get-state'),
  log: message => ipcRenderer.send('slideshow:log', message),
  retryUpdate: () => ipcRenderer.invoke('slideshow:retry-update'),
  onArchiveUpdated: callback => {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const listener = () => callback();
    ipcRenderer.on('slideshow:archive-updated', listener);
    return () => ipcRenderer.removeListener('slideshow:archive-updated', listener);
  },
  onUpdateStatus: callback => {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('slideshow:update-status', listener);
    return () => ipcRenderer.removeListener('slideshow:update-status', listener);
  },
});
