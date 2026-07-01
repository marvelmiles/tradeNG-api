import { z } from "zod";

export const initiatePaymentSchema = z.object({
  payment_ref: z.string().min(1, "Payment reference is required"),
});

export const disputeSchema = z.object({
  reason: z.string().min(10, "Please provide a reason for the dispute (min 10 characters)").max(1000),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type DisputeInput = z.infer<typeof disputeSchema>;
