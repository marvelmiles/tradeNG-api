import { Request } from "express";
import mongoose from "mongoose";

export type PaginationType = "cursor" | "page";

export interface PagePaginationResult {
  type: "page";
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface CursorPaginationResult {
  type: "cursor";
  cursor: string | null;
  next_cursor: string | null;
  has_next: boolean;
  limit: number;
  total: number | null;
}

export type PaginationResult = PagePaginationResult | CursorPaginationResult;

export interface ParsedCursorPagination {
  pagination_type: "cursor";
  cursor: string | null;
  limit: number;
}

export interface ParsedPagePagination {
  pagination_type: "page";
  page: number;
  limit: number;
}

export type ParsedPagination = ParsedCursorPagination | ParsedPagePagination;

export const parsePaginationQuery = (query: Request["query"]): ParsedPagination => {
  const pagination_type = (query.pagination_type as string) === "page" ? "page" : "cursor";
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? "20")), 1), 50);

  if (pagination_type === "page") {
    const page = Math.max(parseInt(String(query.page ?? "1")), 1);
    return { pagination_type: "page", page, limit };
  }

  const cursor = (query.cursor as string) || null;
  return { pagination_type: "cursor", cursor, limit };
};

export const buildPagePagination = (page: number, limit: number, total: number): PagePaginationResult => {
  const total_pages = Math.ceil(total / limit);
  return {
    type: "page",
    page,
    limit,
    total,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
};

export const buildCursorPagination = (
  cursor: string | null,
  items: { _id: mongoose.Types.ObjectId }[],
  limit: number,
  total: number | null = null
): CursorPaginationResult => {
  const has_next = items.length > limit;
  const trimmed = has_next ? items.slice(0, limit) : items;
  const next_cursor = has_next ? trimmed[trimmed.length - 1]._id.toString() : null;

  return {
    type: "cursor",
    cursor,
    next_cursor,
    has_next,
    limit,
    total,
  };
};

export const buildCursorFilter = (cursor: string | null): Record<string, unknown> => {
  if (!cursor) return {};
  return { _id: { $lt: new mongoose.Types.ObjectId(cursor) } };
};
