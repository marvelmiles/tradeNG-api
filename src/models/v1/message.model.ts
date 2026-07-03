import { Schema, model, Document, Types } from "mongoose";

export type MessageType = "TEXT" | "OFFER" | "SYSTEM";

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversation_id: Types.ObjectId;
  sender_id: Types.ObjectId;
  message_type: MessageType;
  body: string | null;
  offer_id: Types.ObjectId | null;
  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation_id: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message_type: { type: String, enum: ["TEXT", "OFFER", "SYSTEM"], default: "TEXT" },
    body: { type: String, default: null, trim: true, maxlength: 2000 },
    offer_id: { type: Schema.Types.ObjectId, ref: "Offer", default: null },
    read_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "messages",
    versionKey: false,
  }
);

messageSchema.index({ conversation_id: 1, created_at: -1 });
messageSchema.index({ conversation_id: 1, read_at: 1 });

export const Message = model<IMessage>("Message", messageSchema);
