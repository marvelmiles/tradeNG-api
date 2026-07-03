import { z } from "zod";

export const updateProfileSchema = z.object({
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  phone_number: z.string().min(7).max(20).optional(),
  about: z.string().max(500).optional(),
  address: z.string().max(300).optional(),
  profile_photo: z.string().url().optional(),
});

export const updatePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const updateNotificationSettingsSchema = z.object({
  email_general: z.boolean().optional(),
  email_offers: z.boolean().optional(),
  in_app_general: z.boolean().optional(),
  in_app_offers: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
