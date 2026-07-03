import { z } from "zod";

export const disputeSchema = z.object({
  reason: z.string().min(10, "Please provide a reason for the dispute (min 10 characters)").max(1000),
  evidence_urls: z.array(z.string().url()).max(6).optional(),
});

export type DisputeInput = z.infer<typeof disputeSchema>;
