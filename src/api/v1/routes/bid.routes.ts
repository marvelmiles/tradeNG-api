import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  placeBid,
  getListingBids,
  acceptBid,
  getMyBids,
  withdrawBid,
} from "@/api/v1/controllers/bid.controller";
import { placeBidSchema } from "@/api/v1/validators/bid";

const router = Router();

router.get("/mine", requireAuth, getMyBids);

router.get("/listings/:listingId/bids", getListingBids);
router.post("/listings/:listingId/bids", requireAuth, validate(placeBidSchema), placeBid);
router.post("/listings/:listingId/bids/:bidId/accept", requireAuth, acceptBid);

router.delete("/:bidId/withdraw", requireAuth, withdrawBid);

export default router;
