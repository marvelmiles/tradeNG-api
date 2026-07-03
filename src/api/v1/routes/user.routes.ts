import { Router } from "express";
import { getUserReviews } from "@/api/v1/controllers/review.controller";

const router = Router();

router.get("/:userId/reviews", getUserReviews);

export default router;
