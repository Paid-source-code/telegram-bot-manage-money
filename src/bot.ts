import { Bot } from "grammy";
import { Transaction } from "./models/transaction.js";
import { parseEntry } from "./parseEntry.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedChatId = process.env.TELEGRAM_CHAT_ID;

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
if (!allowedChatId) throw new Error("TELEGRAM_CHAT_ID is not set");

export const bot = new Bot(token);

bot.use(async (ctx, next) => {
  if (String(ctx.chat?.id) !== allowedChatId) return;
  await next();
});

function formatRupiah(amount: number): string {
  return amount.toLocaleString("id-ID");
}

bot.command("start", (ctx) =>
  ctx.reply(
    "Halo! Catat transaksi dengan format:\n" +
      "-50000 makan siang ayam\n" +
      "+5000000 gaji bulanan\n\n" +
      "Command lain:\n" +
      "/saldo - lihat saldo\n" +
      "/ringkasan [hari|minggu|bulan] - ringkasan\n" +
      "/hapus - hapus transaksi terakhir"
  )
);

bot.command("saldo", async (ctx) => {
  const [{ total: income = 0 } = {}] = await Transaction.aggregate([
    { $match: { type: "income" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const [{ total: expense = 0 } = {}] = await Transaction.aggregate([
    { $match: { type: "expense" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const balance = income - expense;
  await ctx.reply(
    `Saldo: Rp${formatRupiah(balance)}\n` +
      `Pemasukan: Rp${formatRupiah(income)}\n` +
      `Pengeluaran: Rp${formatRupiah(expense)}`
  );
});

bot.command("ringkasan", async (ctx) => {
  const period = ctx.match?.trim().toLowerCase() || "bulan";
  const now = new Date();
  let from: Date;

  if (period === "hari") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "minggu") {
    from = new Date(now);
    from.setDate(now.getDate() - 7);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const results = await Transaction.aggregate([
    { $match: { date: { $gte: from } } },
    { $group: { _id: { type: "$type", category: "$category" }, total: { $sum: "$amount" } } },
    { $sort: { total: -1 } },
  ]);

  if (results.length === 0) {
    await ctx.reply("Belum ada transaksi di periode ini.");
    return;
  }

  const income = results.filter((r) => r._id.type === "income");
  const expense = results.filter((r) => r._id.type === "expense");

  const lines = [`Ringkasan (${period}):`, ""];

  if (expense.length) {
    lines.push("Pengeluaran:");
    for (const r of expense) lines.push(`- ${r._id.category}: Rp${formatRupiah(r.total)}`);
    lines.push("");
  }
  if (income.length) {
    lines.push("Pemasukan:");
    for (const r of income) lines.push(`- ${r._id.category}: Rp${formatRupiah(r.total)}`);
  }

  await ctx.reply(lines.join("\n"));
});

bot.command("hapus", async (ctx) => {
  const last = await Transaction.findOne().sort({ createdAt: -1 });
  if (!last) {
    await ctx.reply("Tidak ada transaksi untuk dihapus.");
    return;
  }
  await last.deleteOne();
  await ctx.reply(
    `Dihapus: ${last.type === "income" ? "+" : "-"}Rp${formatRupiah(last.amount)} (${last.category})`
  );
});

bot.on("message:text", async (ctx) => {
  const parsed = parseEntry(ctx.message.text);
  if (!parsed) {
    await ctx.reply(
      "Format tidak dikenali. Contoh: -50000 makan siang  atau  +5000000 gaji"
    );
    return;
  }

  await Transaction.create({
    type: parsed.type,
    amount: parsed.amount,
    category: parsed.category,
    note: parsed.note,
    date: new Date(),
  });

  const sign = parsed.type === "income" ? "+" : "-";
  await ctx.reply(
    `Tercatat: ${sign}Rp${formatRupiah(parsed.amount)} (${parsed.category}${
      parsed.note ? ", " + parsed.note : ""
    })`
  );
});
