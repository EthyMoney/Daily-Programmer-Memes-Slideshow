const cron = require('node-cron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logToFile = require('./logger');

const todaysDate = new Date().toISOString().split('T')[0];
const subfolder = 'memes-archive';
const imagesFolderPath = path.join(__dirname, subfolder, todaysDate);

// check for memes-archive subfolder, make if not present
if (!fs.existsSync(path.join(__dirname, subfolder))) {
  logToFile('made memes-archive folder')
  fs.mkdirSync(path.join(__dirname, subfolder));
}
// check for today's dated images folder, make if not present
if (!fs.existsSync(imagesFolderPath)) {
  logToFile('made todays memes images folder')
  fs.mkdirSync(imagesFolderPath);
  // since we just made the folder, we need to run the script to download the images for today (since it won't exist yet)
  logToFile('today\'s memes images folder didn\'t exist yet, running script to download images');
  runScript();
}

logToFile('Job scheduler for updating images is activated!\n');

// Schedule the task to run every day at 8 AM
cron.schedule('0 8 * * *', () => {
  logToFile('Running cron job...');
  runScript();
});

function runScript(){
  logToFile('Running download-todays-memes.js script...');

  // Execute the download-todays-memes.js script
  const script = spawn('node', ['./download-todays-memes.js']);

  // Log the script's output
  script.stdout.on('data', (data) => {
    // trim the newline character from the end
    data = data.toString().trim();
    logToFile(data);
  });

  // Log any errors
  script.stderr.on('data', (data) => {
    // trim the newline character from the end
    data = data.toString().trim();
    logToFile(`Error: ${data}`);
  });

  // Log when the script is done running
  script.on('close', (code) => {
    logToFile(`\nMemes download script exited with code ${code} (${(code) ? 'There were errors' : 'No errors'})`);
  });
}
