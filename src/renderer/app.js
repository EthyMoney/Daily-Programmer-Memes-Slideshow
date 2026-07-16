const imageElement = document.getElementById('imageContainer');
const retryUpdateButton = document.getElementById('retryUpdate');
const statusElement = document.getElementById('status');
const updateBadge = document.getElementById('updateBadge');
const updateStatusElement = document.getElementById('updateStatus');
let archiveIdentity = '';
let archiveSignature = '';
let badgeHideTimeout = null;
let cycleInterval = null;
let cycleTimeMilliseconds = 5 * 60 * 1000;
let currentImage = 0;
let currentUpdateStatus = { state: 'starting' };
let displayGeneration = 0;
let displayedArchiveDate = '';
let failedImages = new Set();
let images = [];
let isOffline = !navigator.onLine;
let refreshPromise = null;
let todayDateKey = '';

function log(message) {
  window.slideshow.log(message);
}

function showStatus(message) {
  statusElement.textContent = message;
  statusElement.hidden = false;
  imageElement.hidden = true;
}

function friendlyDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: year === new Date().getFullYear() ? undefined : 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function renderUpdateBadge({ showSuccess = false } = {}) {
  window.clearTimeout(badgeHideTimeout);
  updateBadge.hidden = false;
  retryUpdateButton.hidden = true;
  updateBadge.title = currentUpdateStatus.error || '';
  const showingText = displayedArchiveDate ? ` Showing saved memes from ${friendlyDate(displayedArchiveDate)}.` : '';

  if (isOffline) {
    updateBadge.dataset.state = 'error';
    updateStatusElement.textContent = `Offline.${showingText} Updates resume when the connection returns.`;
    return;
  }

  switch (currentUpdateStatus.state) {
    case 'checking':
    case 'starting':
      updateBadge.dataset.state = 'warning';
      updateStatusElement.textContent = `Checking for new memes...${showingText}`;
      break;
    case 'downloading':
      updateBadge.dataset.state = 'warning';
      updateStatusElement.textContent = `Downloading new memes...${showingText}`;
      break;
    case 'failed': {
      const errorDetail = String(currentUpdateStatus.error || '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[.]+$/, '')
        .slice(0, 90);
      updateBadge.dataset.state = 'error';
      updateStatusElement.textContent = `Update failed${errorDetail ? `: ${errorDetail}` : ''}.${showingText} Retrying automatically within 30 minutes.`;
      retryUpdateButton.hidden = false;
      break;
    }
    case 'partial': {
      const desiredCount = currentUpdateStatus.desiredImageCount || '?';
      updateBadge.dataset.state = 'warning';
      updateStatusElement.textContent = `Update incomplete: ${currentUpdateStatus.imageCount}/${desiredCount} images available.${showingText}`;
      retryUpdateButton.hidden = false;
      break;
    }
    case 'current':
      if (todayDateKey && displayedArchiveDate && displayedArchiveDate < todayDateKey) {
        updateBadge.dataset.state = 'error';
        updateStatusElement.textContent = `Archive is out of date.${showingText}`;
        retryUpdateButton.hidden = false;
      } else if (showSuccess) {
        updateBadge.dataset.state = 'success';
        updateStatusElement.textContent = `Up to date${displayedArchiveDate ? ` · ${friendlyDate(displayedArchiveDate)}` : ''}.`;
        badgeHideTimeout = window.setTimeout(() => {
          if (!isOffline && currentUpdateStatus.state === 'current') {
            updateBadge.hidden = true;
          }
        }, 8000);
      } else {
        updateBadge.hidden = true;
      }
      break;
    default:
      updateBadge.dataset.state = 'warning';
      updateStatusElement.textContent = `Update status is unknown.${showingText}`;
      retryUpdateButton.hidden = false;
  }
}

function applyState(state) {
  if (state?.config?.cycleTimeMinutes) {
    cycleTimeMilliseconds = state.config.cycleTimeMinutes * 60 * 1000;
  }
  if (state?.todayDateKey) {
    todayDateKey = state.todayDateKey;
  }
  if (state?.updateStatus) {
    currentUpdateStatus = state.updateStatus;
  }

  if (!state?.archive) {
    archiveIdentity = '';
    archiveSignature = '';
    images = [];
    currentImage = 0;
    displayedArchiveDate = '';
    showStatus('No saved memes are available yet. Waiting for the background download...');
    renderUpdateBadge();
    return false;
  }

  displayedArchiveDate = state.archive.dateKey;
  const nextIdentity = `${state.archive.dateKey}:${state.archive.revision}`;
  const nextImageNames = state.archive.images.map(image => image.fileName).join('|');
  const nextSignature = `${nextIdentity}:${nextImageNames}`;
  const changed = nextSignature !== archiveSignature;
  if (!changed) {
    renderUpdateBadge();
    return false;
  }

  if (nextIdentity !== archiveIdentity) {
    failedImages = new Set();
  }
  archiveIdentity = nextIdentity;
  archiveSignature = nextSignature;
  images = state.archive.images.filter(image => !failedImages.has(image.fileName));
  currentImage = 0;
  log(`Loaded ${images.length} images from archive ${state.archive.dateKey}.`);
  renderUpdateBadge({ showSuccess: currentUpdateStatus.state === 'current' });
  return true;
}

async function refreshState({ displayWhenChanged = false } = {}) {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = window.slideshow.getState()
    .then(state => {
      const changed = applyState(state);
      if (changed && displayWhenChanged) {
        displayCurrentImage();
      }
      return changed;
    })
    .catch(error => {
      log(`Unable to refresh slideshow state: ${error.message}`);
      if (images.length === 0) {
        showStatus('Unable to read the meme archive. Retrying shortly...');
      }
      return false;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function displayCurrentImage() {
  displayGeneration += 1;
  const generation = displayGeneration;

  if (images.length === 0) {
    showStatus('No usable memes are available. Waiting for an archive update...');
    return;
  }

  currentImage %= images.length;
  const image = images[currentImage];
  imageElement.onload = () => {
    if (generation !== displayGeneration) {
      return;
    }
    statusElement.hidden = true;
    imageElement.hidden = false;
    log(`Displayed ${image.fileName}.`);
    currentImage = (currentImage + 1) % images.length;
  };
  imageElement.onerror = () => {
    if (generation !== displayGeneration) {
      return;
    }
    log(`Skipping unreadable image ${image.fileName}.`);
    failedImages.add(image.fileName);
    images.splice(currentImage, 1);
    if (images.length === 0) {
      showStatus('Every image in this archive failed to load. Waiting for an update...');
      return;
    }
    currentImage %= images.length;
    window.setTimeout(displayCurrentImage, 0);
  };
  imageElement.src = image.url;
}

async function advanceSlideshow() {
  await refreshState();
  displayCurrentImage();
}

function resetCycleTimer() {
  window.clearInterval(cycleInterval);
  cycleInterval = window.setInterval(() => {
    void advanceSlideshow();
  }, cycleTimeMilliseconds);
}

imageElement.addEventListener('click', () => {
  log('Screen clicked; advancing to the next image.');
  void advanceSlideshow();
  resetCycleTimer();
});

async function retryUpdate() {
  retryUpdateButton.disabled = true;
  updateBadge.hidden = false;
  updateBadge.dataset.state = 'warning';
  updateStatusElement.textContent = 'Retrying update now...';
  try {
    await window.slideshow.retryUpdate();
    await refreshState({ displayWhenChanged: true });
  } catch (error) {
    log(`Manual update retry failed: ${error.message}`);
  } finally {
    retryUpdateButton.disabled = false;
  }
}

retryUpdateButton.addEventListener('click', () => {
  void retryUpdate();
});

let cursorTimeout;
function hideCursor() {
  document.body.style.cursor = 'none';
}

document.addEventListener('mousemove', () => {
  document.body.style.cursor = 'auto';
  window.clearTimeout(cursorTimeout);
  cursorTimeout = window.setTimeout(hideCursor, 3000);
});
cursorTimeout = window.setTimeout(hideCursor, 3000);

window.slideshow.onArchiveUpdated(() => {
  void refreshState({ displayWhenChanged: true });
});

window.slideshow.onUpdateStatus(status => {
  currentUpdateStatus = status;
  renderUpdateBadge({ showSuccess: status.state === 'current' });
});

window.addEventListener('offline', () => {
  isOffline = true;
  renderUpdateBadge();
});

window.addEventListener('online', () => {
  const shouldRetry = isOffline && currentUpdateStatus.state === 'failed';
  isOffline = false;
  renderUpdateBadge();
  if (shouldRetry) {
    void retryUpdate();
  }
});

async function initialize() {
  log('Renderer started.');
  await refreshState();
  displayCurrentImage();
  resetCycleTimer();
  window.setInterval(() => {
    void refreshState({ displayWhenChanged: true });
  }, 30000);
}

void initialize();
