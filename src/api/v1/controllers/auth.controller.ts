import { Request, Response } from "express";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { User } from "@/models/v1/user.model";
import { Otp } from "@/models/v1/otp.model";
import { EmailService } from "@/api/v1/services/email.service";
import type {
  SignupInput,
  VerifyEmailInput,
  ResendOtpInput,
  LoginInput,
} from "@/api/v1/validators/auth";

const generateOtp = (): string => String(randomInt(100000, 999999));

const signToken = (user_id: string): string =>
  jwt.sign({ user_id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions["expiresIn"],
  });

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { first_name, last_name, email, password } = req.body as SignupInput;

  const existing = await User.findOne({ email }).select("status").lean();

  if (existing) {
    if (existing.status === "UNVERIFIED") {
      throw new AppError(
        "An unverified account with this email already exists. Please check your email or request a new OTP.",
        409,
      );
    }
    throw new AppError("An account with this email already exists", 409);
  }

  const hashed = await bcrypt.hash(password, 12);
  const delete_at = new Date(
    Date.now() + env.ACCOUNT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  const user = await User.create({
    first_name,
    last_name,
    email,
    password: hashed,
    delete_at,
  });

  const otp = generateOtp();
  const expires_at = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({ user_id: user._id, code: otp, expires_at });

  await EmailService.sendOtp(
    { first_name: user.first_name, email: user.email },
    otp,
  );

  return sendSuccess({
    res,
    code: 201,
    message: `Account created! A verification code has been sent to ${email}. Verify within ${env.OTP_EXPIRY_MINUTES} minutes.`,
    data: {
      user: {
        id: user._id.toString(),
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        status: user.status,
        created_at: user.created_at,
      },
    },
  });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body as VerifyEmailInput;

  const user = await User.findOne({ email })
    .select("first_name last_name email status")
    .lean();

  if (!user) throw new AppError("Account not found", 404);
  if (user.status === "ACTIVE")
    throw new AppError("Email is already verified", 409);
  if (user.status === "SUSPENDED")
    throw new AppError("Account is suspended", 403);

  const record = await Otp.findOne({
    user_id: user._id,
    code: otp,
    used: false,
    expires_at: { $gt: new Date() },
  }).lean();

  if (!record) {
    throw new AppError(
      "Invalid or expired OTP. Please request a new one.",
      400,
    );
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await Otp.findByIdAndUpdate(record._id, { used: true }, { session });
    await User.findByIdAndUpdate(
      user._id,
      { status: "ACTIVE", delete_at: null },
      { session },
    );
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  await EmailService.sendWelcome({
    first_name: user.first_name,
    email: user.email,
  });

  const token = signToken(user._id.toString());

  return sendSuccess({
    res,
    message: "Email verified successfully! Welcome to TradeNG.",
    data: {
      token,
      user: {
        id: user._id.toString(),
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        status: "ACTIVE",
      },
    },
  });
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as ResendOtpInput;

  const user = await User.findOne({ email })
    .select("first_name email status")
    .lean();

  if (!user) throw new AppError("Account not found", 404);
  if (user.status === "ACTIVE")
    throw new AppError("Email is already verified", 409);

  await Otp.updateMany({ user_id: user._id, used: false }, { used: true });

  const otp = generateOtp();
  const expires_at = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({ user_id: user._id, code: otp, expires_at });

  await EmailService.sendOtp(
    { first_name: user.first_name, email: user.email },
    otp,
  );

  return sendSuccess({
    res,
    message: `A new verification code has been sent to ${email}.`,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;

  const user = await User.findOne({ email })
    .select("first_name last_name email password status")
    .lean();

  if (!user) throw new AppError("Invalid email or password", 401);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError("Invalid email or password", 401);

  if (user.status === "UNVERIFIED") {
    throw new AppError(
      "Your account is not verified. Please check your email for the verification code.",
      403,
    );
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(
      "Your account has been suspended. Contact support.",
      403,
    );
  }

  const token = signToken(user._id.toString());

  return sendSuccess({
    res,
    message: "Login successful",
    data: {
      token,
      user: {
        id: user._id.toString(),
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        status: user.status,
      },
    },
  });
});
