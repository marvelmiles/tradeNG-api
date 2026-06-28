import { Request, Response } from "express";

export function handlePaymentWebhook(req: Request, res: Response): void {
  console.log("Received payment webhook:", JSON.stringify(req.body));

  res.status(200).json({ received: true });
}
