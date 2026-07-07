import { Types } from "mongoose";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import { Listing } from "@/models/v1/listing.model";
import { Transaction, ITransaction } from "@/models/v1/transaction.model";
import { EmailService } from "@/api/v1/services/email.service";
import { recordEscrowHold, recordEscrowReversal } from "@/api/v1/services/wallet.service";
import { createNotification } from "@/api/v1/services/notification.service";

interface LeanUser {
  _id: Types.ObjectId;
  first_name: string;
  email: string;
}
interface LeanListingItem {
  _id: Types.ObjectId;
  item_name: string;
}

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

export const markTransactionPaid = async (
  transaction_id: Types.ObjectId | string,
): Promise<"PAID" | null> => {
  const tx = await Transaction.findById(transaction_id)
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListingItem }>("listing_id", "item_name")
    .lean();

  if (!tx || tx.status !== "PENDING_PAYMENT") return null;

  const seller = tx.seller_id as LeanUser;
  const listing = tx.listing_id as LeanListingItem;

  await Transaction.findByIdAndUpdate(tx._id, { status: "PAID" });
  await recordEscrowHold(seller._id, tx._id, tx.seller_amount);

  await EmailService.sendPaymentReceived(
    seller.email,
    seller.first_name,
    listing.item_name,
    tx.seller_amount,
    tx._id.toString(),
  );

  await createNotification({
    user_id: seller._id,
    type: "PAYMENT_RECEIVED",
    title: "Payment received",
    body: `Payment for "${listing.item_name}" is held in escrow. Ship the item to get paid.`,
    related_transaction_id: tx._id,
  }).catch(() => undefined);

  return "PAID";
};

export const markTransactionReversed = async (
  transaction_id: Types.ObjectId | string,
): Promise<"REFUNDED" | null> => {
  const tx = await Transaction.findById(transaction_id)
    .populate<{ buyer_id: LeanUser }>("buyer_id", "email first_name")
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListingItem }>("listing_id", "item_name")
    .lean();

  if (!tx || !["PAID", "RECEIPT_CONFIRMED"].includes(tx.status)) return null;

  const buyer = tx.buyer_id as LeanUser;
  const seller = tx.seller_id as LeanUser;
  const listing = tx.listing_id as LeanListingItem;

  await Transaction.findByIdAndUpdate(tx._id, { status: "REFUNDED" });
  await recordEscrowReversal(seller._id, tx._id, tx.seller_amount);

  await EmailService.sendPaymentReversed(buyer.email, buyer.first_name, listing.item_name, tx.amount);
  await EmailService.sendPaymentReversed(seller.email, seller.first_name, listing.item_name, tx.amount);

  await createNotification({
    user_id: buyer._id,
    type: "PAYMENT_REVERSED",
    title: "Payment reversed",
    body: `Your payment for "${listing.item_name}" was reversed. The transaction has been cancelled.`,
    related_transaction_id: tx._id,
  }).catch(() => undefined);

  await createNotification({
    user_id: seller._id,
    type: "PAYMENT_REVERSED",
    title: "Payment reversed",
    body: `The payment for "${listing.item_name}" was reversed. The escrowed funds have been released.`,
    related_transaction_id: tx._id,
  }).catch(() => undefined);

  return "REFUNDED";
};

export const notifyPaymentFailed = async (
  transaction_id: Types.ObjectId | string,
): Promise<void> => {
  const tx = await Transaction.findById(transaction_id)
    .select("status buyer_id")
    .populate<{ buyer_id: LeanUser }>("buyer_id", "email first_name")
    .lean();

  if (!tx || tx.status !== "PENDING_PAYMENT") return;

  const buyer = tx.buyer_id as LeanUser;

  await createNotification({
    user_id: buyer._id,
    type: "PAYMENT_FAILED",
    title: "Payment failed",
    body: "Your payment attempt failed. You can retry checkout from the transaction.",
    related_transaction_id: tx._id,
  }).catch(() => undefined);
};
