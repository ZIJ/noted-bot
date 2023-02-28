import { Telegraf } from 'telegraf';
import { Client } from '@notionhq/client';
import express from 'express';
import { MongoClient } from 'mongodb';
import { ChatGPTAPI } from 'chatgpt';
import { Analytics } from '@segment/analytics-node';

const bot = new Telegraf(process.env.BOT_TOKEN);
const server = express();
const mongodb = new MongoClient(process.env.MONGODB_URI);
const gpt = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
});
const analytics = new Analytics({ writeKey: process.env.SEGMENT_WRITE_KEY });

// health check
server.get('/', (req, res) => {
  res.send('Noted Bot - OK');
});

server.listen(8080);

function pageTitle(text) {
  const maxLength = 80;
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function getPrompt(subpageTitles, noteText) {
  return `I have the following list of pages, each page contains notes on one topic:

  ${subpageTitles.map((title) => ` - ${title}`).join('\n')}
  
  And the following note text (in quotes):
  
  "${noteText}"
  
  Which of the pages is the note most relevant to?
  
  Respond with page title only.`;
}

async function chooseParentPage(text, rootPage, notionClient) {
  const response = await notionClient.blocks.children.list({
    block_id: rootPage,
    page_size: 1000,
  });

  const subpages = response.results.filter((result) => result.type === 'child_page');
  const subpageTitles = subpages.map((page) => page.child_page.title);
  try {
    const prompt = getPrompt(subpageTitles, text);
    const res = await gpt.sendMessage(prompt);
    const mostRelevantPageTitle = res.text;
    let page = subpages
      .find((p) => p.child_page.title.toLowerCase() === mostRelevantPageTitle.toLowerCase());
    if (!page) {
      page = subpages.find((p) => p.child_page.title.toLowerCase() === 'general');
    }
    if (!page) {
      throw new Error('Failed to identify subpage or find a page named General');
    }
    return page;
  } catch (e) {
    return {
      id: rootPage,
      child_page: { title: 'Root Page' },
    };
  }
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
    analytics.identify({
      userId,
      traits: {
        firstName: ctx.message.from.firstName,
        lastName: ctx.message.from.lastName,
        username: ctx.message.from.username,
      },
    });
  } catch (e) {
    console.log(`Error Segment identifying user: ${userId}`);
  }
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
    analytics.identify({
      userId,
      traits: {
        firstName: ctx.message.from.firstName,
        lastName: ctx.message.from.lastName,
        username: ctx.message.from.username,
      },
    });
  } catch (e) {
    console.log(`Error Segment identifying user: ${userId}`);
  }
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
  const userId = ctx.message.from.id;
  try {
    analytics.track({
      userId,
      event: 'Note',
    });
  } catch (e) {
    console.errlogor(`Error Segment track: ${userId}`);
  }
  try {
    await mongodb.connect();
    const users = mongodb.db('defaultDb').collection('users');
    const user = await users.findOne({ id: ctx.message.from.id });
    if (user) {
      const notion = new Client({ auth: user.notionToken });
      const parentPage = await chooseParentPage(ctx.message.text, user.notionRoot, notion);
      const page = makePageCreateData(ctx.message.text, parentPage.id);
      await notion.pages.create(page);
      ctx.reply(`Saved in ${parentPage.child_page.title}`);
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
