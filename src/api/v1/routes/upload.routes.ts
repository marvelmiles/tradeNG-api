import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { imageUploadMiddleware, videoUploadMiddleware } from "@/utils/upload";
import { uploadImages, uploadVideo } from "@/api/v1/controllers/upload.controller";

const router = Router();

router.post("/images", requireAuth, imageUploadMiddleware, uploadImages);
router.post("/video", requireAuth, videoUploadMiddleware, uploadVideo);

export default router;
