import { Schema, model } from "mongoose";

export type TransactionType = "income" | "expense";

export interface ITransaction {
  type: TransactionType;
  amount: number;
  category: string;
  note?: string;
  date: Date;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  type: { type: String, enum: ["income", "expense"], required: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, required: true },
  note: { type: String },
  date: { type: Date, required: true, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export const Transaction = model<ITransaction>("Transaction", transactionSchema);
