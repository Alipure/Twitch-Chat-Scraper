# Twitch Chat Scraper 🚀💬

A Node.js script that scrapes chat messages from a specified Twitch.tv channel and saves them to a text file. Using Selenium WebDriver, this script captures messages, usernames, and emotes while handling dynamic chat loading with smooth scrolling. Perfect for analyzing Twitch chat activity! 🎮✨

## Features 🌟

- 📩 Extracts chat messages from any Twitch.tv channel.
- 😄 Captures emotes (e.g., `[PogChamp]`, `[Kappa]`) using their `alt` text.
- 🛡️ Deduplicates messages with a `Set` to keep your data clean.
- 💾 Saves messages in the format: `timestamp username: message` to a text file.
- 🔄 Automatically scrolls chat to load older messages.
- 👥 Tracks unique messages and active users.
- 📂 Prompt for custom output file name before scraping.
- 🔢 Number of unique chat blocks distributed in groups from both messages and unique users

total messages / unique viewers * 100 for the percentage

## Requirements 🛠️

- **Node.js**: Version 14 or higher.
- **Selenium WebDriver**: For browser automation.
- **ChromeDriver**: Must match your Chrome browser version.
- **Google Chrome**: Installed on your system (default or custom path).
- **Operating System**: Designed for Linux, but works on Windows/macOS with path adjustments.

## Installation ⚙️

1. **Install Node.js**:

   - Download and install from [nodejs.org](https://nodejs.org).
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/twitch-chat-scraper.git
   cd twitch-chat-scraper
   ```


3. **Install the driver**

```

npm install selenium-webdriver
npm install chromedriver

```

**How to run**:

In terminal type (for accuracy),
```
node twitchChat.js
```
