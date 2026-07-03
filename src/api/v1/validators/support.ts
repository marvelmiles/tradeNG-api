import { z } from "zod";

export const contactSupportSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email("Invalid email address"),
  subject: z.string().min(3).max(150),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export type ContactSupportInput = z.infer<typeof contactSupportSchema>;
