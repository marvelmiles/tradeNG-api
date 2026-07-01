import { Schema, model, Document, Types } from "mongoose";

export type ListingCondition = "NEW" | "USED";
export type ListingStatus = "ACTIVE" | "ENDED" | "SOLD" | "CANCELLED";

export interface IListing extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  condition: ListingCondition;
  start_price: number;
  status: ListingStatus;
  ends_at: Date | null;
  seller_id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const listingSchema = new Schema<IListing>(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    condition: { type: String, enum: ["NEW", "USED"], required: true },
    start_price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["ACTIVE", "ENDED", "SOLD", "CANCELLED"], default: "ACTIVE" },
    ends_at: { type: Date, default: null },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "listings",
    versionKey: false,
  }
);

listingSchema.index({ seller_id: 1, status: 1 });
listingSchema.index({ status: 1, ends_at: 1 });
listingSchema.index({ title: "text", description: "text" });

export const Listing = model<IListing>("Listing", listingSchema);
