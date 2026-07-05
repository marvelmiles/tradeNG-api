import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { Transaction } from "@/models/v1/transaction.model";
import { markTransactionPaid } from "@/api/v1/services/transaction.service";
import {
  verifyWebhookSignature,
  extractOrderReference,
  NombaWebhookEvent,
} from "@/lib/nomba";

export const handlePaymentWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const signature = req.headers["nomba-signature"] as string | undefined;
    const timestamp = req.headers["nomba-timestamp"] as string | undefined;
    const raw_body = req.body as Buffer;

    console.log(
      signature,
      timestamp,
      raw_body,
      typeof raw_body,
      "nomba webhook",
    );

    let payload: NombaWebhookEvent;
    try {
      payload = JSON.parse(raw_body.toString("utf8"));
    } catch {
      res.status(400).json({ received: false });
      return;
    }

    if (!verifyWebhookSignature(payload, timestamp, signature)) {
      res.status(401).json({ received: false });
      return;
    }

    res.status(200).json({ received: true });

    if (payload.event_type !== "payment_success") return;

    const order_reference = extractOrderReference(payload);
    if (!order_reference) return;

    const tx = await Transaction.findOne({ payment_ref: order_reference })
      .select("_id status")
      .lean();

    if (!tx) return;

    await markTransactionPaid(tx._id);
  },
);
