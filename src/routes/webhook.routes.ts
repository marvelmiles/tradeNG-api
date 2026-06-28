import { Router } from "express";
import { handlePaymentWebhook } from "../controllers/webhook.controller";

const router = Router();

router.post("/payment", handlePaymentWebhook);

export default router;
