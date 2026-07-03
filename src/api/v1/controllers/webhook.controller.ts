import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "@/utils/asyncHandler";
import { Transaction } from "@/models/v1/transaction.model";
import { EmailService } from "@/api/v1/services/email.service";
import { recordEscrowHold } from "@/api/v1/services/wallet.service";
import { createNotification } from "@/api/v1/services/notification.service";
import { verifyWebhookSignature, extractNombaPayload } from "@/lib/nomba";

type LeanUser = { _id: Types.ObjectId; first_name: string; email: string };
type LeanListing = { _id: Types.ObjectId; item_name: string };

export const handlePaymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-nomba-signature"] as string | undefined;
  const raw_body = req.body as Buffer;

  if (!verifyWebhookSignature(raw_body, signature)) {
    res.status(401).json({ received: false });
    return;
  }

  let payload;
  try {
    payload = extractNombaPayload(JSON.parse(raw_body.toString("utf8")));
  } catch {
    res.status(400).json({ received: false });
    return;
  }

  res.status(200).json({ received: true });

  if (payload.status !== "SUCCESS" || !payload.order_reference) return;

  const tx = await Transaction.findOne({ payment_ref: payload.order_reference })
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "item_name")
    .lean();

  if (!tx || tx.status !== "PENDING_PAYMENT") return;

  const seller = tx.seller_id as LeanUser;
  const listing = tx.listing_id as LeanListing;

  await Transaction.findByIdAndUpdate(tx._id, { status: "PAID" });
  await recordEscrowHold(seller._id, tx._id, tx.seller_amount);

  await EmailService.sendPaymentReceived(
    seller.email,
    seller.first_name,
    listing.item_name,
    tx.seller_amount,
    tx._id.toString()
  );

  await createNotification({
    user_id: seller._id,
    type: "PAYMENT_RECEIVED",
    title: "Payment received",
    body: `Payment for "${listing.item_name}" is held in escrow. Ship the item to get paid.`,
    related_transaction_id: tx._id,
  }).catch(() => undefined);
});
