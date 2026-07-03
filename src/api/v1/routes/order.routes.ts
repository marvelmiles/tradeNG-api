import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { getBuyingOrders, getSellingOrders } from "@/api/v1/controllers/order.controller";

const router = Router();

router.get("/buying", requireAuth, getBuyingOrders);
router.get("/selling", requireAuth, getSellingOrders);

export default router;
