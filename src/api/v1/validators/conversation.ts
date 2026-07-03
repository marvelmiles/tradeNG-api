import { z } from "zod";

export const createConversationSchema = z.object({
  listing_id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid listing id"),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1, "Message cannot be empty").max(2000),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
