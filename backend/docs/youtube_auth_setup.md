# Setting up YouTube Authentication for Dev Server

This guide will help you set up YouTube authentication for the Chatbot application on your Ubuntu dev server, allowing it to process videos that might require a logged-in session.

## Why This Is Necessary

Your YouTube processing code is working on your local machine because your browser is already logged in to YouTube. On the dev server, however, there's no browser session, so the application needs cookie authentication to access certain YouTube content.

## Option 1: Export Cookies from Your Browser (Recommended)

### Step 1: Set up the environment

1. Connect to your Ubuntu dev server via SSH
2. Navigate to the backend directory of your project
3. Make the export script executable:

```bash
cd backend
chmod +x scripts/export_youtube_cookies.sh
```

4. Run the script:

```bash
./scripts/export_youtube_cookies.sh
```

5. Choose option 1 to export using a browser extension

### Step 2: On your local machine

1. Install the "Get cookies.txt" extension:
   - Chrome: [Get cookies.txt extension](https://chrome.google.com/webstore/detail/get-cookiestxt/bgaddhkoddajcdgocldbbfleckgcbcid)
   - Firefox: [Cookies.txt extension](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. Make sure you're logged in to YouTube in your browser

3. Navigate to YouTube.com

4. Click on the extension icon and export cookies for youtube.com
   - Make sure to include google.com cookies if the option is available

5. Save the exported file as `youtube_cookies.txt`

### Step 3: Transfer the cookies file to your server

1. Use SCP, SFTP, or any file transfer method to copy the cookies file to your server:

```bash
# Example using scp (from your local machine)
scp youtube_cookies.txt user@your-server:~/chatbot/Chatbot/cookies/
```

2. Return to your server and finish the export script process by pressing Enter

### Step 4: Update your environment variables

1. Edit your `.env` file:

```bash
nano .env
```

2. Add the following line:

```
YOUTUBE_COOKIE_PATH=/home/your-username/chatbot/Chatbot/cookies/youtube_cookies.json
```

3. Save and close the file

## Option 2: Use a Headless Browser on the Server

If you can't export cookies from your local machine, you can set up a headless Chrome/Chromium browser on the server:

1. Install Chrome or Chromium:

```bash
sudo apt update
sudo apt install -y chromium-browser
```

2. Install the Selenium package:

```bash
pip install selenium webdriver-manager
```

3. Run the script to login to YouTube:

```bash
./scripts/export_youtube_cookies.sh
```

4. Choose option 2 to use browser_cookie3

## Troubleshooting

### Cookie Authentication Not Working

1. Try refreshing your cookies. Cookies eventually expire, so you may need to repeat the export process every few months.

2. Check if you can access the video manually in your browser. Some videos might have strict restrictions that prevent access even with valid cookies.

3. Verify the path to the cookies file is correct in your `.env` file.

### Missing Transcripts

1. Not all YouTube videos have transcripts. The API can only fetch transcripts for videos that have them enabled.

2. Try a different video that you know has captions/transcripts.

## Maintaining Cookie Authentication

YouTube cookies typically last for a few months before they expire. Plan to refresh your cookies periodically by repeating this process.

## Security Considerations

1. The cookie file contains sensitive authentication information. Make sure it's stored with appropriate permissions:

```bash
chmod 600 ~/chatbot/Chatbot/cookies/youtube_cookies.json
```

2. Consider implementing a process to regularly refresh the cookies to maintain access.

3. Don't commit the cookie file to version control systems. 