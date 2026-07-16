const { app, BrowserWindow, ipcMain, net, powerMonitor, protocol } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  createMemeUrl,
  findNewestUsableArchive,
  resolveMemeUrl,
} = require('./archive');
const { loadConfig } = require('./config');
const { getDateKey } = require('./date-utils');
const logToFile = require('./logger');
const { createScheduler } = require('./scheduler');

const config = loadConfig();
const indexFile = path.join(__dirname, 'index.html');
const indexUrl = pathToFileURL(indexFile).toString();
let mainWindow = null;
let scheduler = null;
let splashWindow = null;
let updateStatus = {
  checkedAt: null,
  state: 'starting',
};

protocol.registerSchemesAsPrivileged([{
  scheme: 'meme',
  privileges: {
    secure: true,
    standard: true,
    stream: true,
    supportFetchAPI: true,
  },
}]);

function isTrustedRenderer(frame) {
  return frame?.url === indexUrl;
}

function assertTrustedRenderer(frame) {
  if (!isTrustedRenderer(frame)) {
    throw new Error('Rejected IPC request from an unexpected renderer.');
  }
}

async function getSlideshowState() {
  const archive = await findNewestUsableArchive();
  return {
    archive: archive ? {
      dateKey: archive.dateKey,
      revision: archive.revision,
      images: archive.images.map(fileName => ({
        fileName,
        url: createMemeUrl(archive.dateKey, fileName, archive.revision),
      })),
    } : null,
    config: {
      cycleTimeMinutes: config.cycleTimeMinutes,
      imageCount: config.imageCount,
    },
    todayDateKey: getDateKey(new Date(), config.timeZone),
    updateStatus,
  };
}

function registerIpcHandlers() {
  ipcMain.handle('slideshow:get-state', async event => {
    assertTrustedRenderer(event.senderFrame);
    return getSlideshowState();
  });

  ipcMain.handle('slideshow:retry-update', async event => {
    assertTrustedRenderer(event.senderFrame);
    if (!scheduler) {
      return { status: 'starting' };
    }
    return scheduler.verifyTodaysImages({ reason: 'manual retry', retryPartial: true });
  });

  ipcMain.on('slideshow:log', (event, message) => {
    if (!isTrustedRenderer(event.senderFrame) || typeof message !== 'string') {
      return;
    }
    const normalizedMessage = message.replace(/[\r\n]+/g, ' ').slice(0, 500);
    logToFile(`Renderer: ${normalizedMessage}`);
  });
}

function registerMemeProtocol() {
  protocol.handle('meme', async request => {
    try {
      const filePath = await resolveMemeUrl(request.url);
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      logToFile(`Rejected meme request: ${error.message}`);
      return new Response('Image not found.', {
        headers: { 'Content-Type': 'text/plain' },
        status: 404,
      });
    }
  });
}

function secureWindowNavigation(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== indexUrl) {
      event.preventDefault();
    }
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    fullscreen: true,
    height: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
    },
    width: 800,
  });
  secureWindowNavigation(mainWindow);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow?.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadFile(indexFile);
}

async function createSplashWindow() {
  splashWindow = new BrowserWindow({
    frame: false,
    height: 300,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    width: 400,
  });
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
  await splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function notifyArchiveUpdated() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('slideshow:archive-updated');
  }
}

function notifyUpdateStatus(status) {
  updateStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('slideshow:update-status', status);
  }
}

async function startup() {
  registerMemeProtocol();
  registerIpcHandlers();
  await createSplashWindow();
  await createMainWindow();

  scheduler = createScheduler({
    onArchiveUpdated: notifyArchiveUpdated,
    onStatusChanged: notifyUpdateStatus,
  });
  scheduler.start();
  powerMonitor.on('resume', () => {
    void scheduler?.verifyTodaysImages({ reason: 'system resume', retryPartial: false });
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady()
    .then(startup)
    .catch(error => {
      logToFile(`Fatal startup error: ${error.stack || error.message}`);
      app.quit();
    });
}

app.on('before-quit', () => {
  scheduler?.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow().catch(error => {
      logToFile(`Unable to recreate main window: ${error.stack || error.message}`);
    });
  }
});
