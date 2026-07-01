import { Router, Request, Response } from "express";
import { env } from "@/config/env";
import v1Router from "@/api/v1/routes/index";
import webhookRouter from "@/api/v1/routes/webhook.routes";
import docsRouter from "@/docs/router";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    api_version: env.API_VERSION,
    timestamp: new Date().toISOString(),
  });
});

router.use("/docs", docsRouter);
router.use("/webhooks", webhookRouter);

router.use(`/${env.API_VERSION}`, v1Router);

export default router;
