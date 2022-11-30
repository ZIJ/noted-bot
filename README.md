# noted-bot

Telegram bot that saves messages it receives into Notion.
Arguably the fastest way to capture your thoughts.

# Getting started

Just add https://t.me/NotedCaptureBot and follow instructions (same as below)

1. Go to https://www.notion.so/my-integrations, create a new integration and copy the token
2. Add your token to Noted Bot: /notionToken <your_token>
3. Share the page that all your notes will go under with your new integration
4. Copy that page's ID from URL and add it to Noted Bot: /notionPage <your_page_id>

# Commands
- **/notionToken** - set Notion integration token
- **/notionPage** - sets Notion root page that all your notes will go under

# Built with
- Node.js
- Telegraf 
- MongoDB Atlas
- Deployed to fly.io: [noted-bot.fly.dev](noted-bot.fly.dev)

Env vars (values in Evernote):
```
BOT_TOKEN
NOTION_TOKEN
NOTION_ROOT
MONGODB_URI
```


