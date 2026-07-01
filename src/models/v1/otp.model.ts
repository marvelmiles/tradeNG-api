import { Schema, model, Document, Types } from "mongoose";

export interface IOtp extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  code: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true },
    expires_at: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "otps",
    versionKey: false,
  }
);

otpSchema.index({ user_id: 1, used: 1 });
otpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const Otp = model<IOtp>("Otp", otpSchema);
