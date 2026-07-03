import { Schema, model, Document, Types } from "mongoose";

export interface IWishlistItem extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  listing_id: Types.ObjectId;
  created_at: Date;
}

const wishlistItemSchema = new Schema<IWishlistItem>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listing_id: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "wishlist_items",
    versionKey: false,
  }
);

wishlistItemSchema.index({ user_id: 1, listing_id: 1 }, { unique: true });
wishlistItemSchema.index({ user_id: 1, created_at: -1 });

export const WishlistItem = model<IWishlistItem>("WishlistItem", wishlistItemSchema);
