import { Schema, model, Document, Types } from "mongoose";

export type TransactionStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "RECEIPT_CONFIRMED"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED";

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId;
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  amount: number;
  platform_fee: number;
  seller_amount: number;
  payment_ref: string | null;
  status: TransactionStatus;
  receipt_confirmed_at: Date | null;
  auto_release_at: Date | null;
  released_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    listing_id: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    buyer_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    platform_fee: { type: Number, required: true, min: 0 },
    seller_amount: { type: Number, required: true, min: 0 },
    payment_ref: { type: String, default: null, sparse: true },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "PAID", "RECEIPT_CONFIRMED", "RELEASED", "DISPUTED", "REFUNDED"],
      default: "PENDING_PAYMENT",
    },
    receipt_confirmed_at: { type: Date, default: null },
    auto_release_at: { type: Date, default: null },
    released_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "transactions",
    versionKey: false,
  }
);

transactionSchema.index({ buyer_id: 1, created_at: -1 });
transactionSchema.index({ seller_id: 1, created_at: -1 });
transactionSchema.index({ payment_ref: 1 }, { unique: true, sparse: true });
transactionSchema.index({ status: 1, auto_release_at: 1 });

export const Transaction = model<ITransaction>("Transaction", transactionSchema);
