import { Schema, model, Document, Types } from "mongoose";

export interface IContactMessage extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  subject: string;
  message: string;
  emailed: boolean;
  created_at: Date;
}

const contactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    emailed: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "contact_messages",
    versionKey: false,
  }
);

contactMessageSchema.index({ created_at: -1 });

export const ContactMessage = model<IContactMessage>("ContactMessage", contactMessageSchema);
