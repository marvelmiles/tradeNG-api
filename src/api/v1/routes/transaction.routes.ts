import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  getTransaction,
  getMyTransactions,
  checkoutTransaction,
  verifyTransaction,
  confirmReceipt,
  releasePayment,
  raiseDispute,
  getDispute,
} from "@/api/v1/controllers/transaction.controller";
import { createReview } from "@/api/v1/controllers/review.controller";
import { disputeSchema } from "@/api/v1/validators/transaction";
import { createReviewSchema } from "@/api/v1/validators/review";

const router = Router();

router.get("/", requireAuth, getMyTransactions);
router.get("/:id", requireAuth, getTransaction);

router.post("/:id/checkout", requireAuth, checkoutTransaction);
router.get("/:id/verify", requireAuth, verifyTransaction);
router.post("/:id/confirm-receipt", requireAuth, confirmReceipt);
router.post("/:id/release", requireAuth, releasePayment);
router.post("/:id/dispute", requireAuth, validate(disputeSchema), raiseDispute);
router.get("/:id/dispute", requireAuth, getDispute);
router.post("/:id/reviews", requireAuth, validate(createReviewSchema), createReview);

export default router;
