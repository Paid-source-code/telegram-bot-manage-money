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

function formatDate(date: Date): string {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

bot.command("start", (ctx) =>
  ctx.reply(
    "Halo! Catat transaksi dengan format:\n" +
      "-50000 makan siang ayam\n" +
      "+5000000 gaji bulanan\n\n" +
      "Command lain:\n" +
      "/saldo - lihat saldo\n" +
      "/ringkasan [hari|minggu|bulan] - ringkasan\n" +
      "/riwayat [jumlah] - daftar transaksi terbaru (default 10)\n" +
      "/edit -50000 makan malam - ubah transaksi terakhir\n" +
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

bot.command("riwayat", async (ctx) => {
  const rawLimit = Number(ctx.match?.trim());
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 10;

  const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(limit);
  if (transactions.length === 0) {
    await ctx.reply("Belum ada transaksi.");
    return;
  }

  const lines = transactions.map((t) => {
    const sign = t.type === "income" ? "+" : "-";
    return `${formatDate(t.date)} | ${sign}Rp${formatRupiah(t.amount)} (${t.category}${
      t.note ? ", " + t.note : ""
    })`;
  });

  await ctx.reply(lines.join("\n"));
});

bot.command("edit", async (ctx) => {
  const last = await Transaction.findOne().sort({ createdAt: -1 });
  if (!last) {
    await ctx.reply("Tidak ada transaksi untuk diedit.");
    return;
  }

  const parsed = parseEntry(ctx.match ?? "");
  if (!parsed) {
    await ctx.reply(
      "Format tidak dikenali. Contoh: /edit -60000 makan malam"
    );
    return;
  }

  last.type = parsed.type;
  last.amount = parsed.amount;
  last.category = parsed.category;
  last.note = parsed.note;
  await last.save();

  const sign = parsed.type === "income" ? "+" : "-";
  await ctx.reply(
    `Diperbarui: ${sign}Rp${formatRupiah(parsed.amount)} (${parsed.category}${
      parsed.note ? ", " + parsed.note : ""
    })`
  );
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
