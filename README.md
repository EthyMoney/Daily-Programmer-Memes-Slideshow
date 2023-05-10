<img src="https://i.imgur.com/IEnO5px.png" alt="subreddit icon" width="150" height="150">

# Daily Programmer Humor Memes Slideshow

This is a simple Electron-based application that displays images from the hottest posts of the day in the [ProgrammerHumor](https://www.reddit.com/r/ProgrammerHumor) subreddit in a slideshow format. The images are downloaded daily in the morning and displayed in full screen, cycling to a new image every 5 minutes (by default). You can also click on the screen to view the next image without waiting.

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

    `npm install`
    
4. (Optional) Customize the options:

    You can configure how many images download each day and how often they cycle by setting that in the `config.json` file. By default, it's set to 36 images, and a cycle time of 5 minutes.

## Running the Application

To run the application, simply use the following command:
`npm start`

The application will then start to display the top images of the day downloaded from the ProgrammerHumor subreddit on an attached screen, cycling every 5 minutes. You can click on the screen to view the next image without waiting. You can leave it running forever and the images will automatically update daily without any intervention.

You may want to consider automating the startup of this app upon boot up of your device if you are using this on a dedicated device or display. This can be done by adding a startup command or shortcut/setting to your operating system. For example, on a Raspberry Pi with a desktop environment, you can add the run command to the settings for startup applications. This process will vary depending on your operating system and desktop environment used, but a quick Google search should help you find the steps for your specific setup. An example startup shell script `begin.sh` and and Gnome app file `memes-app.desktop` is included in this repo for your reference, just edit the paths in them for your use. Whatever you do though, make sure you make those files, or whatever other ones you make, executable. This is done using `chmod +x <file>`.

## Scheduling Daily Image Downloads

The application automatically runs the `download-todays-memes.js` script every day at 8 AM to download new images from the subreddit. Old images are retained as well and every day gets its own folder in the `memes-archive` directory. The application will only display images from the current day, but you can manually view images from previous days by navigating to the `memes-archive` directory and opening the folder for the day you wish to view.

## Log Output

All Electron (main, renderer, loader, etc) and image updater (scheduler, downloader) console.log statements are written to a file named `electron-log.txt` located in the root of the project for later review. This is useful for debugging purposes if you need it.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
