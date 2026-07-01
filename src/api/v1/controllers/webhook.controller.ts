import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "@/utils/asyncHandler";
import { Transaction } from "@/models/v1/transaction.model";
import { EmailService } from "@/api/v1/services/email.service";

type LeanUser = { _id: Types.ObjectId; first_name: string; email: string };
type LeanListing = { _id: Types.ObjectId; title: string };

export const handlePaymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { paymentRef, status, amount: _amount } = req.body as {
    paymentRef?: string;
    status?: string;
    amount?: number;
  };

  res.status(200).json({ received: true, api_version: process.env.API_VERSION ?? "v1" });

  if (!paymentRef || status !== "success") return;

  const tx = await Transaction.findOne({ payment_ref: paymentRef })
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "title")
    .lean();

  if (!tx || tx.status !== "PENDING_PAYMENT") return;

  await Transaction.findByIdAndUpdate(tx._id, { status: "PAID" });

  const seller = tx.seller_id as LeanUser;
  const listing = tx.listing_id as LeanListing;

  await EmailService.sendPaymentReceived(
    seller.email,
    seller.first_name,
    listing.title,
    tx.seller_amount,
    tx._id.toString()
  );
});
