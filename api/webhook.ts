import { webhookCallback } from "grammy";
import { connectDB } from "../src/db.js";
import { bot } from "../src/bot.js";

const handleUpdate = webhookCallback(bot, "next-js");

export default async function handler(req: any, res: any) {
  await connectDB();
  await handleUpdate(req, res);
}
