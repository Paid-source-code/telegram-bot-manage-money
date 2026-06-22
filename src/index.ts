import "dotenv/config";
import { connectDB } from "./db.js";
import { bot } from "./bot.js";

async function main() {
  await connectDB();
  await bot.start();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
