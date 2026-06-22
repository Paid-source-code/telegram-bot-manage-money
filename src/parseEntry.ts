import type { TransactionType } from "./models/transaction.js";

export interface ParsedEntry {
  type: TransactionType;
  amount: number;
  category: string;
  note?: string;
}

const ENTRY_PATTERN = /^([+-])(\d+(?:[.,]\d+)?)\s+(\S+)(?:\s+(.*))?$/;

export function parseEntry(text: string): ParsedEntry | null {
  const match = ENTRY_PATTERN.exec(text.trim());
  if (!match) return null;

  const [, sign, rawAmount, category, note] = match;
  const amount = Number(rawAmount.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    type: sign === "+" ? "income" : "expense",
    amount,
    category: category.toLowerCase(),
    note: note?.trim() || undefined,
  };
}
