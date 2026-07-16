const cron = require('node-cron');
const { ARCHIVE_ROOT, ensureArchiveRoot, listImagesForDate } = require('./archive');
const { DEFAULT_CONFIG, loadConfig } = require('./config');
const { getDateKey } = require('./date-utils');
const { downloadTodaysMemes } = require('./downloader');
const logToFile = require('./logger');

function createScheduler({
  archiveRoot = ARCHIVE_ROOT,
  config = loadConfig(),
  downloader = downloadTodaysMemes,
  logger = logToFile,
  now = () => new Date(),
  onArchiveUpdated = () => {},
  onStatusChanged = () => {},
} = {}) {
  let activeDownload = null;
  let latestStatus = {
    checkedAt: null,
    state: 'starting',
  };
  const tasks = [];

  function reportStatus(status) {
    latestStatus = {
      checkedAt: now().toISOString(),
      ...status,
    };
    try {
      onStatusChanged(latestStatus);
    } catch (error) {
      logger(`Unable to report scheduler status: ${error.message}`);
    }
    return latestStatus;
  }

  async function performVerification({ reason, retryPartial }) {
    const dateKey = getDateKey(now(), config.timeZone);
    reportStatus({ dateKey, reason, state: 'checking' });
    await ensureArchiveRoot(archiveRoot);
    const existingImages = await listImagesForDate(dateKey, archiveRoot);

    if (existingImages.length >= config.imageCount) {
      logger(`Archive verification (${reason}): ${dateKey} already has ${existingImages.length} images.`);
      reportStatus({
        dateKey,
        desiredImageCount: config.imageCount,
        imageCount: existingImages.length,
        reason,
        state: 'current',
      });
      return { complete: true, dateKey, imageCount: existingImages.length, status: 'complete' };
    }
    if (existingImages.length > 0 && !retryPartial) {
      logger(`Archive verification (${reason}): using partial ${dateKey} set with ${existingImages.length} images.`);
      reportStatus({
        dateKey,
        desiredImageCount: config.imageCount,
        imageCount: existingImages.length,
        reason,
        state: 'partial',
      });
      return { complete: false, dateKey, imageCount: existingImages.length, status: 'partial' };
    }

    logger(`Archive verification (${reason}): downloading hot posts for ${dateKey}.`);
    reportStatus({
      dateKey,
      desiredImageCount: config.imageCount,
      imageCount: existingImages.length,
      reason,
      state: 'downloading',
    });
    try {
      const result = await downloader({ archiveRoot, config, dateKey, logger });
      if (result.published) {
        onArchiveUpdated(result);
      }
      reportStatus({
        dateKey,
        desiredImageCount: config.imageCount,
        imageCount: result.imageCount,
        reason,
        state: result.complete ? 'current' : 'partial',
      });
      return result;
    } catch (error) {
      logger(`Archive update failed: ${error.stack || error.message}`);
      reportStatus({
        dateKey,
        error: error.message,
        imageCount: existingImages.length,
        reason,
        retryWithinMinutes: 30,
        state: 'failed',
      });
      return {
        complete: false,
        dateKey,
        error: error.message,
        imageCount: existingImages.length,
        status: 'failed',
      };
    }
  }

  function verifyTodaysImages({ reason = 'manual', retryPartial = true } = {}) {
    if (activeDownload) {
      logger(`Archive verification (${reason}) joined the update already in progress.`);
      return activeDownload;
    }

    activeDownload = performVerification({ reason, retryPartial })
      .catch(error => {
        const dateKey = getDateKey(now(), config.timeZone);
        logger(`Archive verification (${reason}) failed: ${error.stack || error.message}`);
        reportStatus({
          dateKey,
          error: error.message,
          imageCount: 0,
          reason,
          retryWithinMinutes: 30,
          state: 'failed',
        });
        return {
          complete: false,
          dateKey,
          error: error.message,
          imageCount: 0,
          status: 'failed',
        };
      })
      .finally(() => {
        activeDownload = null;
      });
    return activeDownload;
  }

  function schedule(expression, callback, label) {
    if (!cron.validate(expression)) {
      throw new Error(`Invalid ${label} cron expression: ${expression}`);
    }
    tasks.push(cron.schedule(expression, callback, {
      name: `memes-${label}`,
      noOverlap: true,
      timezone: config.timeZone,
    }));
  }

  function start() {
    const dailySchedule = cron.validate(config.downloadSchedule)
      ? config.downloadSchedule
      : DEFAULT_CONFIG.downloadSchedule;
    if (dailySchedule !== config.downloadSchedule) {
      logger(`Invalid download schedule ${config.downloadSchedule}; using ${dailySchedule}.`);
    }
    schedule(dailySchedule, () => {
      void verifyTodaysImages({ reason: 'daily schedule', retryPartial: true });
    }, 'daily-download');
    schedule('15,45 * * * *', () => {
      void verifyTodaysImages({ reason: 'catch-up check', retryPartial: false });
    }, 'catch-up');
    logger(`Image scheduler activated (${dailySchedule}, ${config.timeZone}).`);
    void verifyTodaysImages({ reason: 'startup', retryPartial: true });
  }

  function stop() {
    for (const task of tasks.splice(0)) {
      task.stop();
      task.destroy();
    }
  }

  return {
    getStatus: () => latestStatus,
    start,
    stop,
    verifyTodaysImages,
  };
}

module.exports = {
  createScheduler,
};
