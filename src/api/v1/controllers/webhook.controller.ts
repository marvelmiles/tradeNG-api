import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { Transaction } from "@/models/v1/transaction.model";
import { markTransactionPaid } from "@/api/v1/services/transaction.service";
import { verifyWebhookSignature, extractNombaPayload } from "@/lib/nomba";

export const handlePaymentWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    console.log("webhook initiated", req.headers, req.body);

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

    const tx = await Transaction.findOne({
      payment_ref: payload.order_reference,
    })
      .select("_id status")
      .lean();

    if (!tx) return;

    await markTransactionPaid(tx._id);
  },
);
