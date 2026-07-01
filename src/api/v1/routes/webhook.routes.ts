import { Router } from "express";
import { handlePaymentWebhook } from "@/api/v1/controllers/webhook.controller";

const router = Router();

router.post("/payment", handlePaymentWebhook);

export default router;
