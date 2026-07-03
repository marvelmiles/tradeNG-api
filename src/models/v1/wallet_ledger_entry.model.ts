import { Schema, model, Document, Types } from "mongoose";

export type LedgerEntryType = "ESCROW_HOLD" | "ESCROW_RELEASE" | "WITHDRAWAL_HOLD" | "WITHDRAWAL_REVERSAL";
export type LedgerBucket = "AVAILABLE" | "ESCROW";

export interface IWalletLedgerEntry extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  transaction_id: Types.ObjectId | null;
  withdrawal_id: Types.ObjectId | null;
  type: LedgerEntryType;
  bucket: LedgerBucket;
  amount: number;
  created_at: Date;
}

const walletLedgerEntrySchema = new Schema<IWalletLedgerEntry>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transaction_id: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
    withdrawal_id: { type: Schema.Types.ObjectId, ref: "WithdrawalRequest", default: null },
    type: {
      type: String,
      enum: ["ESCROW_HOLD", "ESCROW_RELEASE", "WITHDRAWAL_HOLD", "WITHDRAWAL_REVERSAL"],
      required: true,
    },
    bucket: { type: String, enum: ["AVAILABLE", "ESCROW"], required: true },
    amount: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "wallet_ledger_entries",
    versionKey: false,
  }
);

walletLedgerEntrySchema.index({ user_id: 1, bucket: 1 });
walletLedgerEntrySchema.index({ user_id: 1, created_at: -1 });

export const WalletLedgerEntry = model<IWalletLedgerEntry>("WalletLedgerEntry", walletLedgerEntrySchema);
