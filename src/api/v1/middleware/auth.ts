import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import { User } from "@/models/v1/user.model";

interface JwtPayload {
  user_id: string;
}

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Authentication token required", 401);
    }

    const token = header.slice(7);
    let payload: JwtPayload;

    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new AppError("Invalid or expired token", 401);
    }

    const user = await User.findById(payload.user_id)
      .select("first_name last_name email status")
      .lean();

    if (!user) throw new AppError("Account not found", 401);

    if (user.status === "UNVERIFIED") {
      throw new AppError("Please verify your email address to continue", 403);
    }

    if (user.status === "SUSPENDED") {
      throw new AppError("Your account has been suspended", 403);
    }

    if (user.status === "DELETED") {
      throw new AppError("Account not found", 401);
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      status: user.status,
    };

    next();
  } catch (err) {
    next(err);
  }
};
