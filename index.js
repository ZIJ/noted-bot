import { Telegraf } from 'telegraf';
import { Client } from '@notionhq/client';

const { BOT_TOKEN, NOTION_TOKEN, NOTION_ROOT } = process.env;

const bot = new Telegraf(BOT_TOKEN);
const notion = new Client({ auth: NOTION_TOKEN });

function makePageCreateData(text) {
  return {
    parent: {
      page_id: NOTION_ROOT,
    },
    properties: {
      title: [{
        text: {
          content: text,
        },
      }],
    },
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
