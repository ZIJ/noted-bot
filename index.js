import { Telegraf } from 'telegraf';
import { Client } from '@notionhq/client';
import express from 'express';

const { BOT_TOKEN, NOTION_TOKEN, NOTION_ROOT } = process.env;

const bot = new Telegraf(BOT_TOKEN);
const notion = new Client({ auth: NOTION_TOKEN });
const server = express();

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

function makePageCreateData(text) {
  return {
    parent: {
      page_id: NOTION_ROOT,
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

bot.command('helloworld', (ctx) => {
  ctx.reply('Hello World!');
});

bot.on('message', async (ctx) => {
  const page = makePageCreateData(ctx.message.text);
  try {
    await notion.pages.create(page);
  } catch (e) {
    console.error(e);
  }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
