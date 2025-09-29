/*
Twitch Chat Scraper
This script extracts chat messages from a specified Twitch channel and saves them to a user-specified text file.
It handles dynamic content loading by scrolling through the chat and captures messages, usernames, and emotes.

Requirements:
- Node.js (v14 or higher)
- Selenium WebDriver
- ChromeDriver (matching Chrome version)
- Google Chrome installed

Usage:
1. Install Node.js from nodejs.org.
2. Install dependencies: npm install selenium-webdriver chromedriver
3. Run: node twitchChat.js
4. Enter the Twitch channel URL or username and output file name when prompted.

Note: Designed for cross-platform use. CSS selectors are accurate as of 27-9-2025 but may need updates if Twitch changes its UI.
*/

const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs').promises; // Use promises for cleaner async file operations
const path = require('path');
const chrome = require('selenium-webdriver/chrome');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify readline.question for cleaner async/await usage
const question = (query) => new Promise((resolve) => readline.question(query, resolve));

// Main function to run the scraper
async function scrapeTwitchChat() {
    let driver;
    try {
        // Prompt for channel and output file
        const channelUrl = await question('Enter the Twitch channel URL (e.g., https://www.twitch.tv/username or username): ');
        const outputFileName = await question('Enter the output file name (e.g., chat.txt): ');
        readline.close();

        // Validate and extract username
        const username = channelUrl.includes('twitch.tv') ? channelUrl.split('/').pop() : channelUrl.trim();
        if (!username) {
            throw new Error('Invalid channel URL or username provided.');
        }

        // Validate output file name
        const outputFile = path.resolve(outputFileName || 'chat.txt');
        if (!outputFile.endsWith('.txt')) {
            console.warn('Output file does not end with .txt; appending extension.');
            outputFile += '.txt';
        }

        // Initialize Chrome options
        const chromeOptions = new chrome.Options();
        const chromeBinaryPath = process.env.CHROME_BINARY_PATH;
        if (chromeBinaryPath) {
            console.log(`Using custom Chrome binary path: ${chromeBinaryPath}`);
            chromeOptions.setChromeBinaryPath(chromeBinaryPath);
        } else {
            console.log('Using default Chrome installation.');
        }

        // Initialize WebDriver
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(chromeOptions)
            .build();

        // Configuration
        const maxScrolls = 50;
        const scrollDelay = 2000; // ms
        const maxMessages = 1000;
        let buffer = 10000; // Initial buffer for page load
        const scrapedMessages = new Set();
        const uniqueUsers = new Set();

        // Navigate to Twitch channel
        const targetUrl = `https://www.twitch.tv/${username}`;
        await driver.get(targetUrl);
        console.log(`Navigated to ${targetUrl}`);

        // Maximize window
        await driver.manage().window().maximize();
        console.log('Maximized window.');

        // Wait for page to load
        await driver.sleep(5000);

        // Accept cookies if present
        try {
            const acceptButton = await driver.wait(
                until.elementLocated(By.css('button[data-a-target="consent-banner-accept"]')),
                5000
            );
            await driver.wait(until.elementIsVisible(acceptButton), 5000);
            await acceptButton.click();
            console.log('Accepted cookies.');
        } catch (e) {
            console.log('No cookie prompt found or failed to click:', e.message);
        }

        // Locate chat container
        let chatContainer;
        try {
            chatContainer = await driver.wait(
                until.elementLocated(By.css('div[data-test-selector="chat-scrollable-area__message-container"]')),
                10000
            );
            console.log('Located chat container.');
        } catch (e) {
            throw new Error('Failed to locate chat container. Twitch UI may have changed.');
        }

        // Scroll and collect messages
        let scrollCount = 0;
        let previousMessageCount = 0;

        while (scrollCount < maxScrolls && scrapedMessages.size < maxMessages) {
            // Get messages
            const messages = await chatContainer.findElements(By.css('div[data-a-target="chat-line-message"]'));
            console.log(`Found ${messages.length} messages on scroll ${scrollCount + 1}`);

            // Process messages
            for (const message of messages) {
                try {
                    // Extract timestamp (use current time as fallback)
                    let timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                    try {
                        const timestampElement = await message.findElement(By.css('span.chat-line__time'));
                        timestamp = await timestampElement.getText();
                    } catch (e) {
                        // Timestamp not always available in Twitch chat
                    }

                    // Extract username
                    let username = 'Unknown';
                    try {
                        username = await message.getAttribute('data-a-user');
                        if (username) uniqueUsers.add(username);
                    } catch (e) {
                        console.log('Username not found, using default:', e.message);
                    }

                    // Extract message content
                    let messageContent = '';
                    try {
                        const contentElements = await message.findElements(
                            By.css('span[data-a-target="chat-message-text"], img[data-a-target="emote-name"]')
                        );
                        if (contentElements.length === 0) {
                            const textContent = await message.findElement(By.css('span')).getText();
                            messageContent = textContent;
                        } else {
                            for (const element of contentElements) {
                                const isEmote = await element.getAttribute('data-a-target');
                                if (isEmote === 'emote-name') {
                                    const emoteName = await element.getAttribute('alt');
                                    messageContent += `[${emoteName}] `;
                                } else {
                                    const text = await element.getText();
                                    messageContent += text + ' ';
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Content not found:', e.message);
                        continue;
                    }

                    // Format and save message
                    const formattedMessage = `${timestamp} ${username}: ${messageContent.trim()}`;
                    if (!scrapedMessages.has(formattedMessage) && messageContent.trim() !== '') {
                        scrapedMessages.add(formattedMessage);
                        await fs.appendFile(outputFile, formattedMessage + '\n', 'utf8');
                        console.log(`Saved: ${formattedMessage}`);
                    }
                } catch (e) {
                    console.error('Error processing a message:', e.message);
                }
            }

            // Log progress
            console.log(`==============================`);
            console.log(`Scroll ${scrollCount + 1} complete. Total unique messages: ${scrapedMessages.size}`);
            console.log(`Unique users: ${uniqueUsers.size}`);
            if (uniqueUsers.size > 0) { 
                const talkativePercentage = ((scrapedMessages.size / uniqueUsers.size)).toFixed(2);
                console.log(`Chat distributed in the number of groups per user. (unique blocks) : ${talkativePercentage}`);  
            }
            console.log(`==============================`);

            // Adjust buffer if no new messages
            if (messages.length === previousMessageCount) {
                buffer += 5000;
                console.log(`No new messages loaded, increasing buffer to ${buffer} ms`);
            } else {
                buffer = 10000; // Reset buffer
            }

            console.log(`Waiting for ${buffer} ms before next scroll...`);
            await driver.sleep(buffer);

            previousMessageCount = messages.length;

            // Scroll to top
            await driver.executeScript(`
                const chat = document.querySelector('div[data-test-selector="chat-scrollable-area__message-container"]');
                if (chat) chat.scrollTop = 0;
            `);

            await driver.sleep(scrollDelay);
            scrollCount++;
        }

        // Final summary
        console.log(`Extracted ${scrapedMessages.size} unique messages to ${outputFile}`);
        console.log(`Total unique users: ${uniqueUsers.size}`);
        if (uniqueUsers.size > 0) {
            const talkativePercentage = ((scrapedMessages.size / uniqueUsers.size)).toFixed(2);
            console.log(`Chat distributed in the number of groups per user. (unique blocks) : ${talkativePercentage}`);
        }

    } catch (error) {
        console.error('An error occurred:', error.message);
    } finally {
        if (driver) {
            await driver.quit();
            console.log('Browser closed.');
        }
    }
}

// Run the scraper
scrapeTwitchChat();