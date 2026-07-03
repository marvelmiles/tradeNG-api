import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  createOffer,
  getOffersReceived,
  getMyOfferThread,
  acceptOffer,
  counterOffer,
  declineOffer,
  withdrawOffer,
} from "@/api/v1/controllers/offer.controller";
import { createOfferSchema, counterOfferSchema, declineOfferSchema } from "@/api/v1/validators/offer";

const router = Router();

router.get("/received", requireAuth, getOffersReceived);
router.get("/listings/:listingId/mine", requireAuth, getMyOfferThread);
router.post("/listings/:listingId", requireAuth, validate(createOfferSchema), createOffer);

router.patch("/:id/accept", requireAuth, acceptOffer);
router.patch("/:id/counter", requireAuth, validate(counterOfferSchema), counterOffer);
router.patch("/:id/decline", requireAuth, validate(declineOfferSchema), declineOffer);
router.patch("/:id/withdraw", requireAuth, withdrawOffer);

export default router;
