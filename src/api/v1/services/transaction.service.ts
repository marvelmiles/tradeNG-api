import { Types } from "mongoose";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import { Listing } from "@/models/v1/listing.model";
import { Transaction, ITransaction } from "@/models/v1/transaction.model";

interface SaleListing {
  _id: Types.ObjectId;
  status: string;
  seller_id: Types.ObjectId;
  price: number;
}

export const createTransactionForSale = async (
  listing: SaleListing,
  buyer_id: string,
  amount: number
): Promise<ITransaction> => {
  if (listing.status !== "ACTIVE") throw new AppError("This listing is no longer available", 400);
  if (listing.seller_id.toString() === buyer_id) {
    throw new AppError("You cannot buy your own listing", 400);
  }

  const platform_fee = parseFloat((amount * (env.PLATFORM_FEE_PERCENT / 100)).toFixed(2));
  const seller_amount = parseFloat((amount - platform_fee).toFixed(2));

  const reserved_listing = await Listing.findOneAndUpdate(
    { _id: listing._id, status: "ACTIVE" },
    { status: "SOLD" }
  ).lean();

  if (!reserved_listing) throw new AppError("This listing is no longer available", 400);

  try {
    return await Transaction.create({
      listing_id: listing._id,
      buyer_id,
      seller_id: listing.seller_id,
      amount,
      platform_fee,
      seller_amount,
    });
  } catch (err) {
    await Listing.findByIdAndUpdate(listing._id, { status: "ACTIVE" });
    throw err;
  }
};
