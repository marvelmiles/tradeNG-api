import { z } from "zod";

export const requestCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters").max(60),
  reason: z.string().min(10, "Please explain why this category is needed (min 10 characters)").max(500),
});

export type RequestCategoryInput = z.infer<typeof requestCategorySchema>;
