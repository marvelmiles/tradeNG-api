import { Schema, model, Document, Types } from "mongoose";

export type OfferStatus = "PENDING" | "ACCEPTED" | "COUNTERED" | "DECLINED" | "WITHDRAWN";

export interface IOffer extends Document {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId;
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  amount: number;
  note: string | null;
  status: OfferStatus;
  parent_offer_id: Types.ObjectId | null;
  responded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const offerSchema = new Schema<IOffer>(
  {
    listing_id: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    buyer_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: null, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "COUNTERED", "DECLINED", "WITHDRAWN"],
      default: "PENDING",
    },
    parent_offer_id: { type: Schema.Types.ObjectId, ref: "Offer", default: null },
    responded_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "offers",
    versionKey: false,
  }
);

offerSchema.index({ listing_id: 1, buyer_id: 1, created_at: -1 });
offerSchema.index({ seller_id: 1, status: 1, created_at: -1 });
offerSchema.index({ buyer_id: 1, status: 1, created_at: -1 });

export const Offer = model<IOffer>("Offer", offerSchema);
