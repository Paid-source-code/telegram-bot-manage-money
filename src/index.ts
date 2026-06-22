import "dotenv/config";
import { connectDB } from "./db.js";
import { bot } from "./bot.js";

async function main() {
  await connectDB();
  // Telegram disallows polling and webhook at once; clear any webhook
  // left over from production before starting local long-polling.
  await bot.api.deleteWebhook();
  await bot.start();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
