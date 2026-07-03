import { Request, Response } from "express";
import { AppError } from "@/utils/AppError";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  parsePaginationQuery,
  buildPagePagination,
  buildCursorPagination,
  buildCursorFilter,
} from "@/utils/pagination";
import { Category } from "@/models/v1/category.model";
import { CategoryRequest } from "@/models/v1/category_request.model";
import type { RequestCategoryInput } from "@/api/v1/validators/category";

const formatCategory = (category: { _id: { toString(): string }; name: string; slug: string; image: string | null; is_active: boolean }) => ({
  id: category._id.toString(),
  name: category.name,
  slug: category.slug,
  image: category.image,
  is_active: category.is_active,
});

const formatCategoryRequest = (request: {
  _id: { toString(): string };
  name: string;
  reason: string;
  status: string;
  resolved_category_id: { toString(): string } | null;
  created_at: Date;
}) => ({
  id: request._id.toString(),
  name: request.name,
  reason: request.reason,
  status: request.status,
  resolved_category_id: request.resolved_category_id?.toString() ?? null,
  created_at: request.created_at,
});

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await Category.find({ is_active: true }).sort({ name: 1 }).lean();

  return sendSuccess({
    res,
    data: { categories: categories.map(formatCategory) },
  });
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findOne({ _id: id, is_active: true }).lean();
  if (!category) throw new AppError("Category not found", 404);

  return sendSuccess({ res, data: { category: formatCategory(category) } });
});

export const requestCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, reason } = req.body as RequestCategoryInput;

  const request = await CategoryRequest.create({
    requested_by: req.user!.id,
    name,
    reason,
  });

  return sendSuccess({
    res,
    code: 201,
    message: "Category request submitted. We'll review it and notify you once it's created.",
    data: { category_request: formatCategoryRequest(request) },
  });
});

export const getMyCategoryRequests = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const where = { requested_by: req.user!.id };

  if (pagination.pagination_type === "cursor") {
    const items = await CategoryRequest.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { category_requests: items.slice(0, pagination.limit).map(formatCategoryRequest) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    CategoryRequest.find(where).sort({ _id: -1 }).skip(skip).limit(pagination.limit).lean(),
    CategoryRequest.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { category_requests: items.map(formatCategoryRequest) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});
