const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DEFAULT_CONFIG = Object.freeze({
  imageCount: 36,
  cycleTimeMinutes: 5,
  debugLogToFile: true,
  timeZone: 'America/Chicago',
  downloadSchedule: '0 8 * * *',
  maxConcurrentDownloads: 4,
  maxImageSizeMB: 50,
});

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function validateConfig(value, warn = console.warn) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const config = { ...DEFAULT_CONFIG };

  const useInteger = (key, minimum, maximum) => {
    if (Number.isInteger(input[key]) && input[key] >= minimum && input[key] <= maximum) {
      config[key] = input[key];
    } else if (Object.hasOwn(input, key)) {
      warn(`Invalid config value for ${key}; using ${DEFAULT_CONFIG[key]}.`);
    }
  };

  useInteger('imageCount', 1, 100);
  useInteger('cycleTimeMinutes', 1, 1440);
  useInteger('maxConcurrentDownloads', 1, 10);
  useInteger('maxImageSizeMB', 1, 250);

  if (typeof input.debugLogToFile === 'boolean') {
    config.debugLogToFile = input.debugLogToFile;
  } else if (Object.hasOwn(input, 'debugLogToFile')) {
    warn(`Invalid config value for debugLogToFile; using ${DEFAULT_CONFIG.debugLogToFile}.`);
  }

  if (typeof input.timeZone === 'string' && isValidTimeZone(input.timeZone)) {
    config.timeZone = input.timeZone;
  } else if (Object.hasOwn(input, 'timeZone')) {
    warn(`Invalid config value for timeZone; using ${DEFAULT_CONFIG.timeZone}.`);
  }

  if (typeof input.downloadSchedule === 'string' && input.downloadSchedule.trim()) {
    config.downloadSchedule = input.downloadSchedule.trim();
  } else if (Object.hasOwn(input, 'downloadSchedule')) {
    warn(`Invalid config value for downloadSchedule; using ${DEFAULT_CONFIG.downloadSchedule}.`);
  }

  return Object.freeze(config);
}

function loadConfig({ configPath = CONFIG_PATH, warn = console.warn } = {}) {
  try {
    const contents = fs.readFileSync(configPath, 'utf8');
    return validateConfig(JSON.parse(contents), warn);
  } catch (error) {
    warn(`Unable to load ${configPath}: ${error.message}. Using default configuration.`);
    return validateConfig({}, warn);
  }
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_CONFIG,
  isValidTimeZone,
  loadConfig,
  validateConfig,
};
