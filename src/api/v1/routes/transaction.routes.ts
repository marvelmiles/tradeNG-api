import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  getTransaction,
  getMyTransactions,
  initiatePayment,
  confirmPayment,
  confirmReceipt,
  releasePayment,
  raiseDispute,
} from "@/api/v1/controllers/transaction.controller";
import { initiatePaymentSchema, disputeSchema } from "@/api/v1/validators/transaction";

const router = Router();

router.get("/", requireAuth, getMyTransactions);
router.get("/:id", requireAuth, getTransaction);

router.post("/:id/initiate-payment", requireAuth, validate(initiatePaymentSchema), initiatePayment);
router.post("/confirm-payment", requireAuth, confirmPayment);
router.post("/:id/confirm-receipt", requireAuth, confirmReceipt);
router.post("/:id/release", requireAuth, releasePayment);
router.post("/:id/dispute", requireAuth, validate(disputeSchema), raiseDispute);

export default router;
