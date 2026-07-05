import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  signup,
  verifyEmail,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  signout,
} from "@/api/v1/controllers/auth.controller";
import {
  signupSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/api/v1/validators/auth";

const router = Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post("/resend-otp", validate(resendOtpSchema), resendOtp);
router.post("/login", validate(loginSchema), login);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post("/signout", requireAuth, signout);

export default router;
