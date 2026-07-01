import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  createListing,
  getListings,
  getListing,
  updateListing,
  cancelListing,
  getMyListings,
} from "@/api/v1/controllers/listing.controller";
import { createListingSchema, updateListingSchema, listingsQuerySchema } from "@/api/v1/validators/listing";

const router = Router();

router.get("/", validate(listingsQuerySchema, "query"), getListings);
router.get("/mine", requireAuth, getMyListings);
router.get("/:id", getListing);

router.post("/", requireAuth, validate(createListingSchema), createListing);
router.patch("/:id", requireAuth, validate(updateListingSchema), updateListing);
router.delete("/:id", requireAuth, cancelListing);

export default router;
