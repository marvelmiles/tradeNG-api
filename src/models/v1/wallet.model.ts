import { Schema, model, Document, Types } from "mongoose";

export interface IWallet extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "wallets",
    versionKey: false,
  }
);

walletSchema.index({ user_id: 1 }, { unique: true });

export const Wallet = model<IWallet>("Wallet", walletSchema);
