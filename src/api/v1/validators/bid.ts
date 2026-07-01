import { z } from "zod";

export const placeBidSchema = z.object({
  amount: z.number().positive("Bid amount must be greater than 0"),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;
