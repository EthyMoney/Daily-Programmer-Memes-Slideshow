const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'electron-log.txt');
// Load the configuration values from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

//!
//!   NOTE: The timestamps in the log file have this format:
//!        [MM/DD/YYYY HOUR:MINUTE:SECOND:MILLISECOND]
//!            example: [05/05/2023 09:24:50.457]
//!
//!              24hr format local time is used
//!

function logToFile(message) {
  const currentLocalDate = new Date();
  const timestamp = currentLocalDate.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  }).replace(',', '');

  // Check if message already starts with a timestamp
  const timestampRegex = /^\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\.\d{3}\]/;
  if (timestampRegex.test(message)) {
    // this is a duplicate log message that Electron threw back at us from the console.log statement below
    // so, we don't want to log it to file again. These mainly come from the image downloading script.
    console.log(message)
    return;
  }

  const formattedMessage = `[${timestamp}] ${message}\n`;

  console.log(formattedMessage); // also send to console

  // Only write to file if debugLogToFile is true in config.json (default is true)
  if (config.debugLogToFile){
    fs.appendFile(logFile, formattedMessage, (err) => {
      if (err) {
        console.error('Failed to write log to file:', err);
      }
    });
  }
}

module.exports = logToFile;


module.exports = logToFile;
