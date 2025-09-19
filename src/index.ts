import { Bot } from "grammy";
import { TELEGRAM_TOKEN } from "./config.js";

const bot = new Bot(TELEGRAM_TOKEN);

bot.on("message:text", (ctx) => ctx.reply("Hello! I am your bot."));

bot.start();
