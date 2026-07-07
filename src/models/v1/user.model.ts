import { Schema, model, Document, Types } from "mongoose";

export type UserStatus = "UNVERIFIED" | "ACTIVE" | "SUSPENDED" | "DELETED";
export type UserRole = "BUYER" | "SELLER";

export interface INotificationSettings {
  email_general: boolean;
  email_offers: boolean;
  in_app_general: boolean;
  in_app_offers: boolean;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  token_version: number;
  phone_number: string | null;
  about: string | null;
  address: string | null;
  profile_photo: string | null;
  role: UserRole;
  status: UserStatus;
  delete_at: Date | null;
  is_phone_verified: boolean;
  is_verified_seller: boolean;
  verification_requested_at: Date | null;
  notification_settings: INotificationSettings;
  created_at: Date;
  updated_at: Date;
}

const notificationSettingsSchema = new Schema<INotificationSettings>(
  {
    email_general: { type: Boolean, default: true },
    email_offers: { type: Boolean, default: true },
    in_app_general: { type: Boolean, default: true },
    in_app_offers: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    first_name: { type: String, required: true, trim: true, maxlength: 50 },
    last_name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    // Bumped on signout to invalidate every previously issued JWT for this user.
    token_version: { type: Number, default: 0 },
    phone_number: { type: String, default: null, trim: true },
    about: { type: String, default: null, trim: true, maxlength: 500 },
    address: { type: String, default: null, trim: true, maxlength: 300 },
    profile_photo: { type: String, default: null },
    role: { type: String, enum: ["BUYER", "SELLER"], default: "BUYER" },
    status: { type: String, enum: ["UNVERIFIED", "ACTIVE", "SUSPENDED", "DELETED"], default: "UNVERIFIED" },
    delete_at: { type: Date, default: null },
    is_phone_verified: { type: Boolean, default: false },
    is_verified_seller: { type: Boolean, default: false },
    verification_requested_at: { type: Date, default: null },
    notification_settings: { type: notificationSettingsSchema, default: () => ({}) },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "users",
    versionKey: false,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1, delete_at: 1 });
userSchema.index({ is_verified_seller: 1 });

export const User = model<IUser>("User", userSchema);
