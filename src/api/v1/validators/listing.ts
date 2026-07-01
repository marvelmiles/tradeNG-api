import { z } from "zod";

export const createListingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(120),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000),
  condition: z.enum(["NEW", "USED"]),
  start_price: z.number().positive("Start price must be greater than 0"),
  ends_at: z.iso
    .datetime({ message: "Invalid date format" })
    .optional()
    .refine((val) => !val || new Date(val) > new Date(), {
      message: "End date must be in the future",
    }),
});

export const updateListingSchema = createListingSchema
  .partial()
  .omit({ start_price: true });

export const listingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().optional(),
  condition: z.enum(["NEW", "USED"]).optional(),
  status: z.enum(["ACTIVE", "ENDED", "SOLD", "CANCELLED"]).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type ListingsQuery = z.infer<typeof listingsQuerySchema>;
