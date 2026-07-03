import { Schema, model, Document, Types } from "mongoose";

export type CategoryRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ICategoryRequest extends Document {
  _id: Types.ObjectId;
  requested_by: Types.ObjectId;
  name: string;
  reason: string;
  status: CategoryRequestStatus;
  resolved_category_id: Types.ObjectId | null;
  rejection_notified: boolean;
  created_at: Date;
  updated_at: Date;
}

const categoryRequestSchema = new Schema<ICategoryRequest>(
  {
    requested_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    resolved_category_id: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    rejection_notified: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "category_requests",
    versionKey: false,
  }
);

categoryRequestSchema.index({ requested_by: 1, created_at: -1 });
categoryRequestSchema.index({ status: 1, name: 1 });

export const CategoryRequest = model<ICategoryRequest>("CategoryRequest", categoryRequestSchema);
