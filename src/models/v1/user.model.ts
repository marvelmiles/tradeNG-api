import { Schema, model, Document, Types } from "mongoose";

export type UserStatus = "UNVERIFIED" | "ACTIVE" | "SUSPENDED";

export interface IUser extends Document {
  _id: Types.ObjectId;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  status: UserStatus;
  delete_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<IUser>(
  {
    first_name: { type: String, required: true, trim: true, maxlength: 50 },
    last_name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    status: { type: String, enum: ["UNVERIFIED", "ACTIVE", "SUSPENDED"], default: "UNVERIFIED" },
    delete_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "users",
    versionKey: false,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1, delete_at: 1 });

export const User = model<IUser>("User", userSchema);
