import { Router } from "express";
import { validate } from "@/api/v1/middleware/validate";
import { contactSupport } from "@/api/v1/controllers/support.controller";
import { contactSupportSchema } from "@/api/v1/validators/support";

const router = Router();

router.post("/contact", validate(contactSupportSchema), contactSupport);

export default router;
