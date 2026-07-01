import { Router } from "express";
import { validate } from "@/api/v1/middleware/validate";
import { signup, verifyEmail, resendOtp, login } from "@/api/v1/controllers/auth.controller";
import { signupSchema, verifyEmailSchema, resendOtpSchema, loginSchema } from "@/api/v1/validators/auth";

const router = Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post("/resend-otp", validate(resendOtpSchema), resendOtp);
router.post("/login", validate(loginSchema), login);

export default router;
