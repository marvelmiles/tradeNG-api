import { Router } from "express";
import webhookRoutes from "./webhook.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.use("/webhooks", webhookRoutes);

export default router;
