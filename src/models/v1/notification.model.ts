import { Schema, model, Document, Types } from "mongoose";

export type NotificationType =
  | "OFFER_RECEIVED"
  | "OFFER_ACCEPTED"
  | "OFFER_COUNTERED"
  | "OFFER_DECLINED"
  | "OFFER_WITHDRAWN"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REVERSED"
  | "RECEIPT_CONFIRMED"
  | "PAYMENT_RELEASED"
  | "DISPUTE_RAISED"
  | "DISPUTE_RESOLVED"
  | "REVIEW_RECEIVED"
  | "CATEGORY_REQUEST_APPROVED"
  | "NEW_MESSAGE"
  | "WITHDRAWAL_UPDATE"
  | "SELLER_VERIFIED";

export interface INotification extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  related_listing_id: Types.ObjectId | null;
  related_transaction_id: Types.ObjectId | null;
  related_conversation_id: Types.ObjectId | null;
  read_at: Date | null;
  created_at: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "OFFER_RECEIVED",
        "OFFER_ACCEPTED",
        "OFFER_COUNTERED",
        "OFFER_DECLINED",
        "OFFER_WITHDRAWN",
        "PAYMENT_RECEIVED",
        "PAYMENT_FAILED",
        "PAYMENT_REVERSED",
        "RECEIPT_CONFIRMED",
        "PAYMENT_RELEASED",
        "DISPUTE_RAISED",
        "DISPUTE_RESOLVED",
        "REVIEW_RECEIVED",
        "CATEGORY_REQUEST_APPROVED",
        "NEW_MESSAGE",
        "WITHDRAWAL_UPDATE",
        "SELLER_VERIFIED",
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 150 },
    body: { type: String, required: true, maxlength: 500 },
    related_listing_id: { type: Schema.Types.ObjectId, ref: "Listing", default: null },
    related_transaction_id: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
    related_conversation_id: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    read_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "notifications",
    versionKey: false,
  }
);

notificationSchema.index({ user_id: 1, read_at: 1, created_at: -1 });
notificationSchema.index({ user_id: 1, created_at: -1 });

export const Notification = model<INotification>("Notification", notificationSchema);
