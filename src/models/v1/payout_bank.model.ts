import { Schema, model, Document, Types } from "mongoose";

export interface IPayoutBank extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

const payoutBankSchema = new Schema<IPayoutBank>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bank_name: { type: String, required: true, trim: true },
    account_number: { type: String, required: true, trim: true },
    account_name: { type: String, required: true, trim: true },
    is_default: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "payout_banks",
    versionKey: false,
  }
);

payoutBankSchema.index({ user_id: 1 });

export const PayoutBank = model<IPayoutBank>("PayoutBank", payoutBankSchema);
