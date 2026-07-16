<img src="assets/subreddit-logo.png" alt="subreddit icon" width="150" height="150">

# Daily Programmer Humor Memes Slideshow

This is a simple Electron-based application that displays images from the hot [ProgrammerHumor](https://www.reddit.com/r/ProgrammerHumor) subreddit feed in a slideshow format. Images are downloaded daily in the morning and displayed full screen, cycling to a new image every 5 minutes by default. You can also click the screen to view the next image without waiting.

The Reddit RSS feed is the primary source. The public JSON endpoints are retained as a fallback. Downloads happen in the background, so an unavailable network or Reddit feed does not prevent the newest usable saved archive from being displayed.

## Why?

Because we all need a little humor in our lives, especially when it comes to programming. The programmer humor subreddit usually doesn't disappoint either 😂

I personally use this application to display the images on a spare monitor in my office at work. I also have it on a Raspberry Pi with a top-mounted 3.5" screen at home. It's a fun thing to glance at every once in a while while working and it's a great conversation starter with coworkers and visitors. I hope you enjoy it as much as I do!

## Prerequisites

Before running the application, make sure you have the following software installed:

- Node.js (v18.0.0 or higher) with npm (v9.0.0 or higher, should be included with Node.js installer)

## Setup

1. Clone this repository to your local machine:

    `git clone https://github.com/EthyMoney/Daily-Programmer-Memes-Slideshow.git`

2. Navigate to the project directory:

    `cd Daily-Programmer-Memes-Slideshow`

3. Install the project dependencies:

    `npm ci`
    
4. (Optional) Customize the options:

    Settings are stored in `config/config.json`:

    - `imageCount`: desired number of images per day (1–100)
    - `cycleTimeMinutes`: time each image remains visible
    - `debugLogToFile`: enables `electron-log.txt`
    - `timeZone`: timezone used for archive dates and scheduling
    - `downloadSchedule`: cron expression for the daily update
    - `maxConcurrentDownloads`: simultaneous image downloads (four by default for Pi-friendly resource use)
    - `maxImageSizeMB`: maximum accepted size for a single image

    Invalid values are replaced with safe defaults and reported in the log.

## Project Structure

```text
assets/                  Static project assets
config/                  User-editable runtime configuration
deploy/                  Desktop and systemd launcher examples
scripts/                 Local startup scripts
src/main/                Electron main process, scheduler, and downloader
src/preload/             Sandboxed renderer bridge
src/renderer/            Slideshow HTML, styles, and browser code
test/                    Node test suite
memes-archive/           Downloaded runtime images (ignored by Git)
```

## Running the Application

To run the application, simply use the following command:
`npm start`

The application immediately displays the newest usable archive while checking for today's hot-post images in the background. You can click the screen to advance early. A single-instance lock prevents two copies from writing to the same archive.

When a background download publishes a newer archive, the slideshow switches to its first image immediately. A small status badge remains visible while checking or downloading, and stays on screen for offline, failed, incomplete, or stale updates. Failed and incomplete states include a **Retry now** button; connection recovery also retries a failed update automatically.

To run only the downloader for troubleshooting:

`npm run download`

You may want to consider automating the startup of this app upon boot up of your device if you are using this on a dedicated device or display. This can be done by adding a startup command or shortcut/setting to your operating system. For example, on a Raspberry Pi with a desktop environment, you can add the run command to the settings for startup applications. 

This process varies by desktop environment. The included `scripts/begin.sh` starts the project from any working directory, and `deploy/memes-app.desktop` is an example graphical-session autostart entry. Do not enable both desktop autostart and the systemd service below.

If using desktop autostart, make the launcher files executable with `chmod +x scripts/begin.sh deploy/memes-app.desktop`.

For a restart-on-failure systemd user service, copy and enable the included example:

```bash
mkdir -p ~/.config/systemd/user
cp deploy/memes-app.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now memes-app.service
```

The example expects the project at `~/Daily-Programmer-Memes-Slideshow`. Edit `WorkingDirectory` and `ExecStart` if you cloned it elsewhere. The graphical session must export the display environment to the systemd user manager; if your desktop does not do that automatically, the `.desktop` method may be simpler.

## Scheduling Daily Image Downloads

The application runs its downloader at the configured schedule, which defaults to 8 AM in `America/Chicago`. A catch-up check runs every 30 minutes and after system resume if today's archive is absent. Updates are protected against overlap.

Images are streamed into a hidden staging directory, checked for supported image signatures and configured size limits, and published only when at least one usable image is present. If fewer than the requested number succeed, the set is explicitly recorded as partial. Existing archives remain available, and the slideshow selects the newest nonempty date rather than assuming today or yesterday is usable.

Old images remain retained, with each day in its own `memes-archive` folder.

## Development Checks

Run the complete local check with:

`npm run check`

The test suite covers configuration validation, timezone-aware dates, archive selection and path containment, transactional download outcomes, RSS parsing, and scheduler overlap behavior.

## Log Output

All Electron (main, renderer, loader, etc) and image updater (scheduler, downloader) console.log statements are written to a file named `electron-log.txt` located in the root of the project for later review. This is useful for debugging purposes if you need it. You can disable this in `config/config.json`, but this logging is enabled by default.

<br>

## Open Source

#### License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

#### Contributing
Contributions are welcome and encouraged! Please feel free to open issues for problems you encounter or feature requests and ideas you come up with. If you would like to contribute code, please open a pull request and describe your changes and reasoning for them. This app is my very first time working with Electron, so you will likely find some dumb things I did that could be improved or built upon. Thank you in advance for your help!
