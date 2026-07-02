import { Request, Response, NextFunction } from "express";
import { ZodError, ZodIssue } from "zod";
import { AppError } from "@/utils/AppError";
import { sendError } from "@/utils/response";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ZodError) {
    sendError({
      res,
      message: "Validation error",
      code: 400,
      errors: err.issues.map((e: ZodIssue) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    sendError({
      res,
      message: err.message,
      code: err.statusCode,
      stack: err.stack,
    });
    return;
  }

  const stack = err instanceof Error ? err.stack : undefined;

  sendError({
    res,
    message: "An unexpected error occurred. Please try again later.",
    code: 500,
    stack,
  });
};
