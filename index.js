import { Telegraf } from 'telegraf';
import { Client } from '@notionhq/client';
import express from 'express';
import { MongoClient } from 'mongodb';

const bot = new Telegraf(process.env.BOT_TOKEN);
const server = express();
const mongodb = new MongoClient(process.env.MONGODB_URI);

// health check
server.get('/', (req, res) => {
  res.send('Noted Bot - OK');
});

server.listen(8080);

function pageTitle(text) {
  const maxLength = 35;
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function makePageCreateData(text, rootPage) {
  return {
    parent: {
      page_id: rootPage,
    },
    properties: {
      title: [{
        text: {
          content: pageTitle(text),
        },
      }],
    },
    children: [{
      object: 'block',
      type: 'paragraph',
      paragraph: {
        text: [{
          type: 'text',
          text: {
            content: text,
          },
        }],
      },
    }],
  };
}

bot.start((ctx) => ctx.reply(`
Hi there! Noted Bot saves all messages it receives into your Notion.
Configure:
1. Go to https://www.notion.so/my-integrations, create a new integration and copy the token
2. Add your token to Noted Bot: /notionToken <your_token>
3. Share the page that all your notes will go under with your new integration
4. Copy that page's ID from URL and add it to Noted Bot: /notionPage <your_page_id>
`));

bot.command('helloworld', (ctx) => {
  ctx.reply('Hello World!');
});

bot.command('notionToken', async (ctx) => {
  const userId = ctx.message.from.id;
  const notionToken = ctx.message.text.substring(13);
  try {
    await mongodb.connect();
    const users = mongodb.db('defaultDb').collection('users');
    const updateDoc = {
      $set: {
        id: userId,
        notionToken,
      },
    };
    await users.updateOne({ id: userId }, updateDoc, { upsert: true });
  } finally {
    await mongodb.close();
  }
});

bot.command('notionPage', async (ctx) => {
  const userId = ctx.message.from.id;
  const notionRoot = ctx.message.text.substring(12);
  try {
    await mongodb.connect();
    const users = mongodb.db('defaultDb').collection('users');
    const updateDoc = {
      $set: {
        id: userId,
        notionRoot,
      },
    };
    await users.updateOne({ id: userId }, updateDoc, { upsert: true });
  } finally {
    await mongodb.close();
  }
});

bot.on('message', async (ctx) => {
  try {
    await mongodb.connect();
    const users = mongodb.db('defaultDb').collection('users');
    const user = await users.findOne({ id: ctx.message.from.id });
    if (user) {
      const notion = new Client({ auth: user.notionToken });
      const page = makePageCreateData(ctx.message.text, user.notionRoot);
      await notion.pages.create(page);
    } else {
      ctx.reply('Notion integration not configured. Use /notionToken and /notionRoot commands.');
    }
  } finally {
    await mongodb.close();
  }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
