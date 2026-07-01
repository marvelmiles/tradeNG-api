import { Schema, model, Document, Types } from "mongoose";

export type ReminderType = "1h" | "5h" | "24h" | "3d" | "6d";

export interface IVerificationReminder extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  type: ReminderType;
  created_at: Date;
}

const verificationReminderSchema = new Schema<IVerificationReminder>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["1h", "5h", "24h", "3d", "6d"], required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "verification_reminders",
    versionKey: false,
  }
);

verificationReminderSchema.index({ user_id: 1, type: 1 }, { unique: true });

export const VerificationReminder = model<IVerificationReminder>(
  "VerificationReminder",
  verificationReminderSchema
);
