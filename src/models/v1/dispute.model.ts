import { Schema, model, Document, Types } from "mongoose";

export type DisputeStatus = "OPEN" | "RESOLVED_BUYER" | "RESOLVED_SELLER" | "CLOSED";

export interface IDispute extends Document {
  _id: Types.ObjectId;
  transaction_id: Types.ObjectId;
  raised_by: Types.ObjectId;
  description: string;
  evidence_urls: string[];
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const disputeSchema = new Schema<IDispute>(
  {
    transaction_id: { type: Schema.Types.ObjectId, ref: "Transaction", required: true },
    raised_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    evidence_urls: { type: [String], default: [] },
    status: { type: String, enum: ["OPEN", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"], default: "OPEN" },
    resolution_note: { type: String, default: null, trim: true, maxlength: 1000 },
    resolved_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "disputes",
    versionKey: false,
  }
);

disputeSchema.index({ transaction_id: 1 }, { unique: true });
disputeSchema.index({ status: 1, created_at: -1 });

export const Dispute = model<IDispute>("Dispute", disputeSchema);
