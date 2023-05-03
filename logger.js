const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'electron-log.txt');

function logToFile(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;

  console.log(formattedMessage); //also send to console, ya know, cus yeah

  fs.appendFile(logFile, formattedMessage, (err) => {
    if (err) {
      console.error('Failed to write log to file:', err);
    }
  });
}

module.exports = logToFile;
