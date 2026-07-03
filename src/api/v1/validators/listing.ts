import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid category id");

const conditionEnum = z.enum(["NEW", "LIKE_NEW", "USED"]);
const deliveryOptionEnum = z.enum(["SELF_DELIVERY", "PICKUP", "HUB_DROPOFF"]);
const listingStatusEnum = z.enum(["DRAFT", "ACTIVE", "SOLD", "CANCELLED"]);

export const createListingSchema = z
  .object({
    item_name: z.string().min(3, "Item name must be at least 3 characters").max(120),
    category_id: objectIdSchema,
    condition: conditionEnum,
    defect_description: z.string().max(1000).optional(),
    description: z.string().min(10, "Description must be at least 10 characters").max(2000),
    images: z.array(z.string().url()).max(8).optional(),
    video: z.string().url().optional(),
    price: z.number().positive("Price must be greater than 0"),
    allow_price_negotiation: z.boolean().optional().default(false),
    delivery_options: z.array(deliveryOptionEnum).min(1, "Select at least one delivery option"),
    pickup_address: z.string().max(300).optional(),
    location: z.string().max(120).optional(),
    status: z.enum(["DRAFT", "ACTIVE"]).optional().default("DRAFT"),
  })
  .refine((data) => !data.delivery_options.includes("PICKUP") || !!data.pickup_address, {
    message: "Pickup address is required when pickup delivery is offered",
    path: ["pickup_address"],
  })
  .refine((data) => data.status !== "ACTIVE" || (data.images && data.images.length > 0), {
    message: "At least one image is required to publish a listing",
    path: ["images"],
  });

export const updateListingSchema = z
  .object({
    item_name: z.string().min(3).max(120).optional(),
    category_id: objectIdSchema.optional(),
    condition: conditionEnum.optional(),
    defect_description: z.string().max(1000).optional(),
    description: z.string().min(10).max(2000).optional(),
    images: z.array(z.string().url()).max(8).optional(),
    video: z.string().url().optional(),
    price: z.number().positive().optional(),
    allow_price_negotiation: z.boolean().optional(),
    delivery_options: z.array(deliveryOptionEnum).min(1).optional(),
    pickup_address: z.string().max(300).optional(),
    location: z.string().max(120).optional(),
  })
  .refine((data) => !data.delivery_options?.includes("PICKUP") || !!data.pickup_address, {
    message: "Pickup address is required when pickup delivery is offered",
    path: ["pickup_address"],
  });

export const listingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().optional(),
  category_id: objectIdSchema.optional(),
  condition: conditionEnum.optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  location: z.string().optional(),
  verified_sellers_only: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  status: listingStatusEnum.optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type ListingsQuery = z.infer<typeof listingsQuerySchema>;
