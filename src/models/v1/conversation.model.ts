import { Schema, model, Document, Types } from "mongoose";

export interface IConversation extends Document {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId;
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  last_message_at: Date | null;
  last_message_preview: string | null;
  created_at: Date;
  updated_at: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    listing_id: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    buyer_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    last_message_at: { type: Date, default: null },
    last_message_preview: { type: String, default: null, maxlength: 200 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "conversations",
    versionKey: false,
  }
);

conversationSchema.index({ listing_id: 1, buyer_id: 1 }, { unique: true });
conversationSchema.index({ seller_id: 1, last_message_at: -1 });
conversationSchema.index({ buyer_id: 1, last_message_at: -1 });

export const Conversation = model<IConversation>("Conversation", conversationSchema);
