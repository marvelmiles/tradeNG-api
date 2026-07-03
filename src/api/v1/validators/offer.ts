import { z } from "zod";

export const createOfferSchema = z.object({
  amount: z.number().positive("Offer amount must be greater than 0"),
  note: z.string().max(500).optional(),
});

export const counterOfferSchema = z.object({
  amount: z.number().positive("Counter offer amount must be greater than 0"),
  note: z.string().max(500).optional(),
});

export const declineOfferSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
export type DeclineOfferInput = z.infer<typeof declineOfferSchema>;
