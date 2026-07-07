import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { Transaction } from "@/models/v1/transaction.model";
import {
  markTransactionPaid,
  markTransactionReversed,
  notifyPaymentFailed,
} from "@/api/v1/services/transaction.service";
import {
  verifyWebhookSignature,
  extractOrderReference,
  NombaWebhookEvent,
} from "@/lib/nomba";

const findTransactionByReference = async (payload: NombaWebhookEvent) => {
  const order_reference = extractOrderReference(payload);
  if (!order_reference) return null;

  return Transaction.findOne({ payment_ref: order_reference })
    .select("_id status")
    .lean();
};

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

    switch (payload.event_type) {
      case "payment_success": {
        const tx = await findTransactionByReference(payload);
        if (tx) await markTransactionPaid(tx._id);
        break;
      }
      case "payment_failed": {
        const tx = await findTransactionByReference(payload);
        if (tx) await notifyPaymentFailed(tx._id);
        break;
      }
      case "payment_reversal": {
        const tx = await findTransactionByReference(payload);
        if (tx) await markTransactionReversed(tx._id);
        break;
      }
      default:
        break;
    }
  },
);
