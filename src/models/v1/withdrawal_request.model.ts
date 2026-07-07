import { Schema, model, Document, Types } from "mongoose";

export type WithdrawalStatus = "PENDING" | "COMPLETED" | "REJECTED" | "CANCELLED";

export interface IWithdrawalRequest extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: WithdrawalStatus;
  created_at: Date;
  updated_at: Date;
}

const withdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    bank_name: { type: String, required: true, trim: true },
    account_number: { type: String, required: true, trim: true },
    account_name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["PENDING", "COMPLETED", "REJECTED", "CANCELLED"], default: "PENDING" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "withdrawal_requests",
    versionKey: false,
  }
);

withdrawalRequestSchema.index({ user_id: 1, created_at: -1 });
withdrawalRequestSchema.index({ status: 1 });

export const WithdrawalRequest = model<IWithdrawalRequest>("WithdrawalRequest", withdrawalRequestSchema);
