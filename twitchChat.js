/*

Twitch Chat Scraper
This script extracts chat messages from a specified Twitch channel and saves them to a text file.
It handles dynamic content loading by scrolling through the chat and captures messages.

Requirements:
- Node.js
- Selenium WebDriver
- ChromeDriver
- Google Chrome installed (uses default system Chrome unless a custom path is specified)

Usage:
1. Ensure you have Node.js installed.
2. Install Selenium WebDriver: npm install selenium-webdriver
3. Download ChromeDriver and ensure it matches your Chrome version.
4. (Optional) Set the CHROME_BINARY_PATH environment variable to your Chrome binary if not using the default.
5. Run the script using: node twitch.js
6. Enter the Twitch channel URL or username when prompted.

Note:   This script is designed for Windows systems but should work on other OS with path adjustments.
        Selecting elements by CSS selectors is accurate as of 27-9-2025 but could change if Twitch updates their site.

*/

const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const chrome = require('selenium-webdriver/chrome');

// Ask the user which Twitch channel to extract
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Enter the Twitch channel URL (e.g., https://www.twitch.tv/username or username): ', async (channelUrl) => {
    readline.close();

    // Extract username from URL if full URL is provided
    const username = channelUrl.includes('twitch.tv') ? channelUrl.split('/').pop() : channelUrl;

    // Initialize Chrome options
    const chromeOptions = new chrome.Options();

    // Use custom Chrome binary path if specified via environment variable
    const chromeBinaryPath = process.env.CHROME_BINARY_PATH;
    if (chromeBinaryPath) {
        console.log(`Using custom Chrome binary path: ${chromeBinaryPath}`);
        chromeOptions.setChromeBinaryPath(chromeBinaryPath);
    } else {
        console.log('Using default Chrome installation.');
    }

    // Initialize the WebDriver
    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();

    // Output file
    const chatFile = 'chat.txt'; // Adjusted to relative path for portability
    const scrapedMessages = new Set(); // To avoid duplicate messages
    const uniqueUsers = new Set(); // To track unique usernames
    const maxScrolls = 50; // Maximum number of scroll attempts
    const scrollDelay = 2000; // Delay between scrolls (ms)
    const maxMessages = 1000; // Maximum number of messages to collect
    let buffer = 10000;

    try {
        // Create output directory if it doesn't exist
        const outputDir = './Twitch-Chat-Scraper';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Navigate to the Twitch channel
        await driver.get(`https://www.twitch.tv/${username}`);
        console.log(`Navigated to https://www.twitch.tv/${username}`);

        // Maximize the window
        await driver.manage().window().maximize();
        console.log('Maximized window.');

        // Wait for 5 seconds to allow the page to load
        await driver.sleep(5000);

        // Accept cookies if the prompt appears
        try {
            let acceptButton = await driver.wait(
                until.elementLocated(By.css('button[data-a-target="consent-banner-accept"]')),
                5000
            );
            await driver.wait(until.elementIsVisible(acceptButton), 5000);
            await acceptButton.click();
            console.log('Accepted cookies.');
        } catch (e) {
            console.log('No cookie prompt found or failed to click:', e.message);
        }

        // Locate the chat container
        let chatContainer = await driver.wait(
            until.elementLocated(By.css('div[data-test-selector="chat-scrollable-area__message-container"]')),
            10000
        );
        console.log('Located chat container.');

        // Scroll and collect messages
        let scrollCount = 0;
        let previousMessageCount = 0;

        while (scrollCount < maxScrolls && scrapedMessages.size < maxMessages) {
            // Get current messages
            let messages = await chatContainer.findElements(By.css('div[data-a-target="chat-line-message"]'));
            console.log(`Found ${messages.length} messages on scroll ${scrollCount + 1}`);

            // Extract every message and save to file
            for (let message of messages) {
                try {
                    // Extract timestamp (Twitch chat may not always display timestamps; using a placeholder)
                    let timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // Current time as fallback
                    try {
                        let timestampElement = await message.findElement(By.css('span.chat-line__time'));
                        timestamp = await timestampElement.getText();
                    } catch (e) {
                        // console.log('Timestamp not found, using current time:', e.message);
                    }

                    // Extract username
                    let username = 'Unknown';
                    try {
                        username = await message.getAttribute('data-a-user');
                        uniqueUsers.add(username); // Add username to Set to track unique users
                    } catch (e) {
                        console.log('Username not found, using default:', e.message);
                    }

                    // Extract message content, including text and potential emotes
                    let messageContent = '';
                    try {
                        let contentElements = await message.findElements(By.css('span[data-a-target="chat-message-text"], img[data-a-target="emote-name"]'));
                        if (contentElements.length === 0) {
                            // Fallback to raw text if no child elements
                            let textContent = await message.findElement(By.css('span')).getText();
                            messageContent = textContent;
                        } else {
                            for (let element of contentElements) {
                                let isEmote = await element.getAttribute('data-a-target');
                                if (isEmote === 'emote-name') {
                                    let emoteName = await element.getAttribute('alt');
                                    messageContent += `[${emoteName}] `;
                                } else {
                                    let text = await element.getText();
                                    messageContent += text + ' ';
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Content not found, logging HTML for debugging:', e.message);
                        // Log the outer HTML of the message for debugging
                        let html = await message.getAttribute('outerHTML');
                        console.log('Message HTML:', html);
                        continue; // Skip this message
                    }

                    // Combine timestamp, username, and message content
                    let formattedMessage = `${timestamp} ${username}: ${messageContent.trim()}`;

                    // Avoid duplicate messages
                    if (!scrapedMessages.has(formattedMessage) && messageContent.trim() !== '') {
                        scrapedMessages.add(formattedMessage);
                        fs.appendFileSync(chatFile, formattedMessage + '\n', 'utf8');
                        console.log(`Saved: ${formattedMessage}`);
                    }
                } catch (e) {
                    console.error('Error processing a message:', e.message);
                }
            }

            console.log(`==============================`);
            console.log(`Scroll ${scrollCount + 1} complete. Total unique messages so far: ${scrapedMessages.size}`);
            console.log(`Number of unique users: ${uniqueUsers.size}`);
            console.log(`==============================`);

            // Increase buffer time if no new messages were loaded
            if (messages.length === previousMessageCount) {
                buffer += 5000; // Increase buffer by 5 seconds
                console.log('No new messages loaded, increasing buffer to', buffer, 'ms');
            } else {
                buffer = 10000; // Reset buffer to default
            }

            console.log('Waiting for', buffer, 'ms before next scroll...');
            await driver.sleep(buffer);

            previousMessageCount = messages.length;

            // Scroll to the top of the chat container
            await driver.executeScript(`
                const chatContainer = document.querySelector('div[data-test-selector="chat-scrollable-area__message-container"]');
                chatContainer.scrollTop = 0;
            `);

            // Wait for new messages to load
            await driver.sleep(scrollDelay);
            scrollCount++;
        }

        console.log(`Extracted ${scrapedMessages.size} unique messages to ${chatFile}`);
        console.log(`Total unique users: ${uniqueUsers.size}`);
    } catch (error) {
        console.error('An error occurred:', error.message);
    } finally {
        // Quit the driver
        await driver.quit();
        console.log('Browser closed.');
    }
});