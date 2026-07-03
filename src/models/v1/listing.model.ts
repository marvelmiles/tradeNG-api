import { Schema, model, Document, Types } from "mongoose";

export type ListingCondition = "NEW" | "LIKE_NEW" | "USED";
export type ListingStatus = "DRAFT" | "ACTIVE" | "SOLD" | "CANCELLED";
export type DeliveryOption = "SELF_DELIVERY" | "PICKUP" | "HUB_DROPOFF";

export interface IListing extends Document {
  _id: Types.ObjectId;
  item_name: string;
  category_id: Types.ObjectId;
  condition: ListingCondition;
  defect_description: string | null;
  description: string;
  images: string[];
  video: string | null;
  price: number;
  allow_price_negotiation: boolean;
  delivery_options: DeliveryOption[];
  pickup_address: string | null;
  location: string | null;
  status: ListingStatus;
  seller_id: Types.ObjectId;
  view_count: number;
  created_at: Date;
  updated_at: Date;
}

const listingSchema = new Schema<IListing>(
  {
    item_name: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    category_id: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    condition: { type: String, enum: ["NEW", "LIKE_NEW", "USED"], required: true },
    defect_description: { type: String, default: null, trim: true, maxlength: 1000 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    images: { type: [String], default: [] },
    video: { type: String, default: null },
    price: { type: Number, required: true, min: 0 },
    allow_price_negotiation: { type: Boolean, default: false },
    delivery_options: {
      type: [{ type: String, enum: ["SELF_DELIVERY", "PICKUP", "HUB_DROPOFF"] }],
      default: [],
    },
    pickup_address: { type: String, default: null, trim: true, maxlength: 300 },
    location: { type: String, default: null, trim: true, maxlength: 120 },
    status: { type: String, enum: ["DRAFT", "ACTIVE", "SOLD", "CANCELLED"], default: "DRAFT" },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    view_count: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "listings",
    versionKey: false,
  }
);

listingSchema.index({ status: 1, category_id: 1, created_at: -1 });
listingSchema.index({ status: 1, price: 1 });
listingSchema.index({ seller_id: 1, status: 1 });
listingSchema.index({ item_name: "text", description: "text" });

export const Listing = model<IListing>("Listing", listingSchema);
