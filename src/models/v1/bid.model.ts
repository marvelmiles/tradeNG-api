import { Schema, model, Document, Types } from "mongoose";

export type BidStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface IBid extends Document {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId;
  bidder_id: Types.ObjectId;
  amount: number;
  status: BidStatus;
  created_at: Date;
  updated_at: Date;
}

const bidSchema = new Schema<IBid>(
  {
    listing_id: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    bidder_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"], default: "PENDING" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "bids",
    versionKey: false,
  }
);

bidSchema.index({ listing_id: 1, status: 1, amount: -1 });
bidSchema.index({ bidder_id: 1, created_at: -1 });

export const Bid = model<IBid>("Bid", bidSchema);
