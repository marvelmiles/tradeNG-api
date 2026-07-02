import { Response } from "express";
import { env } from "@/config/env";
import type { PaginationResult } from "@/utils/pagination";

const HTTP_STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "CREATED",
  204: "NO_CONTENT",
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
};

const resolveStatusText = (code: number): string =>
  HTTP_STATUS_TEXT[code] ??
  (code >= 500 ? "SERVER_ERROR" : code >= 400 ? "CLIENT_ERROR" : "SUCCESS");

interface SuccessPayload<T> {
  res: Response;
  data?: T | null;
  message?: string;
  code?: number;
  pagination?: PaginationResult | null;
}

interface ErrorPayload {
  res: Response;
  message: string;
  code?: number;
  stack?: string | null;
  errors?: { field: string; message: string }[] | null;
}

export const sendSuccess = <T>({
  res,
  data = null,
  message = "Success",
  code = 200,
  pagination = null,
}: SuccessPayload<T>): Response => {
  return res.status(code).json({
    success: true,
    message,
    data: data ?? null,
    pagination,
    code,
    status: resolveStatusText(code),
    error_stack: null,
    error_log_time: null,
    api_version: env.API_VERSION,
  });
};

export const sendError = ({
  res,
  message,
  code = 500,
  stack = null,
  errors = null,
}: ErrorPayload): Response => {
  console.log(
    `[Error] ${code} - ${message}`,
    stack ?? "No stack trace available",
  );

  return res.status(code).json({
    success: false,
    message,
    data: errors ?? null,
    pagination: null,
    code,
    status: resolveStatusText(code),
    error_stack: env.NODE_ENV === "development" ? stack : null,
    error_log_time: new Date().toISOString(),
    api_version: env.API_VERSION,
  });
};
