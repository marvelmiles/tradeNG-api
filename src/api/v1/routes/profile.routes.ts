import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  getMe,
  updateMe,
  getUserPublicProfile,
  getStats,
  getTrustScore,
  requestVerification,
  updatePassword,
  updateNotificationSettings,
  deleteAccount,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "@/api/v1/controllers/profile.controller";
import { updateProfileSchema, updatePasswordSchema, updateNotificationSettingsSchema } from "@/api/v1/validators/profile";

const router = Router();

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, validate(updateProfileSchema), updateMe);
router.delete("/me", requireAuth, deleteAccount);

router.get("/users/:userId", getUserPublicProfile);

router.get("/stats", requireAuth, getStats);
router.get("/trust-score", requireAuth, getTrustScore);
router.post("/verify", requireAuth, requestVerification);
router.patch("/password", requireAuth, validate(updatePasswordSchema), updatePassword);
router.patch("/notification-settings", requireAuth, validate(updateNotificationSettingsSchema), updateNotificationSettings);

router.get("/wishlist", requireAuth, getWishlist);
router.post("/wishlist/:listingId", requireAuth, addToWishlist);
router.delete("/wishlist/:listingId", requireAuth, removeFromWishlist);

export default router;
