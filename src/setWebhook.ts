import "dotenv/config";
import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;
const url = process.argv[2];

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
if (!url) throw new Error("Usage: npm run set-webhook -- https://your-app.vercel.app/api/webhook");

const bot = new Bot(token);

await bot.api.setWebhook(url);
console.log("Webhook set to:", url);
