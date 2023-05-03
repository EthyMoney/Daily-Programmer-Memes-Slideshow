const cron = require('node-cron');
const { spawn } = require('child_process');

console.log('Job scheduler for updating images is activated!');

// Schedule the task to run every day at 8 AM
cron.schedule('0 8 * * *', () => {
  console.log('Running download-todays-memes.js script...');

  // Execute the download-todays-memes.js script
  const script = spawn('node', ['./download-todays-memes.js']);

  // Log the script's output
  script.stdout.on('data', (data) => {
    console.log(`Output: ${data}`);
  });

  // Log any errors
  script.stderr.on('data', (data) => {
    console.error(`Error: ${data}`);
  });

  // Log when the script is done running
  script.on('close', (code) => {
    console.log(`download-todays-memes.js script exited with code ${code}`);
  });
});
