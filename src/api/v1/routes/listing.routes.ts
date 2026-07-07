import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  createListing,
  publishListing,
  getListings,
  getListing,
  updateListing,
  cancelListing,
  buyListing,
  getMyListings,
  getUserActiveListings,
} from "@/api/v1/controllers/listing.controller";
import { createListingSchema, updateListingSchema, listingsQuerySchema } from "@/api/v1/validators/listing";

const router = Router();

router.get("/", validate(listingsQuerySchema, "query"), getListings);
router.get("/mine", requireAuth, getMyListings);
router.get("/users/:userId", getUserActiveListings);
router.get("/:id", getListing);

router.post("/", requireAuth, validate(createListingSchema), createListing);
router.post("/:id/buy", requireAuth, buyListing);
router.patch("/:id/publish", requireAuth, publishListing);
router.patch("/:id", requireAuth, validate(updateListingSchema), updateListing);
router.delete("/:id", requireAuth, cancelListing);

export default router;
