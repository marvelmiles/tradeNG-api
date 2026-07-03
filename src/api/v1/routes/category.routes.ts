import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  getCategories,
  getCategory,
  requestCategory,
  getMyCategoryRequests,
} from "@/api/v1/controllers/category.controller";
import { requestCategorySchema } from "@/api/v1/validators/category";

const router = Router();

router.get("/", getCategories);
router.get("/requests/mine", requireAuth, getMyCategoryRequests);
router.post("/requests", requireAuth, validate(requestCategorySchema), requestCategory);
router.get("/:id", getCategory);

export default router;
