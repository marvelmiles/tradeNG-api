import { Schema, model, Document, Types } from "mongoose";

export type ReviewerRole = "BUYER" | "SELLER";

export interface IReview extends Document {
  _id: Types.ObjectId;
  transaction_id: Types.ObjectId;
  reviewer_id: Types.ObjectId;
  reviewee_id: Types.ObjectId;
  reviewer_role: ReviewerRole;
  rating: number;
  comment: string | null;
  created_at: Date;
  updated_at: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    transaction_id: { type: Schema.Types.ObjectId, ref: "Transaction", required: true },
    reviewer_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewee_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewer_role: { type: String, enum: ["BUYER", "SELLER"], required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: null, trim: true, maxlength: 1000 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "reviews",
    versionKey: false,
  }
);

reviewSchema.index({ transaction_id: 1, reviewer_id: 1 }, { unique: true });
reviewSchema.index({ reviewee_id: 1, created_at: -1 });

export const Review = model<IReview>("Review", reviewSchema);
