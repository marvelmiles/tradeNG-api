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
import { Transaction } from "@/models/v1/transaction.model";
import { Review } from "@/models/v1/review.model";
import { createNotification } from "@/api/v1/services/notification.service";
import type { CreateReviewInput } from "@/api/v1/validators/review";

const formatReview = (review: {
  _id: { toString(): string };
  reviewer_id: { toString(): string };
  reviewee_id: { toString(): string };
  reviewer_role: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}) => ({
  id: review._id.toString(),
  reviewer_id: review.reviewer_id.toString(),
  reviewee_id: review.reviewee_id.toString(),
  reviewer_role: review.reviewer_role,
  rating: review.rating,
  comment: review.comment,
  created_at: review.created_at,
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rating, comment } = req.body as CreateReviewInput;
  const user_id = req.user!.id;

  const tx = await Transaction.findById(id).select("buyer_id seller_id status").lean();
  if (!tx) throw new AppError("Transaction not found", 404);
  if (tx.status !== "RELEASED") throw new AppError("Reviews can only be left after payment has been released", 400);

  const is_buyer = tx.buyer_id.toString() === user_id;
  const is_seller = tx.seller_id.toString() === user_id;
  if (!is_buyer && !is_seller) throw new AppError("Forbidden", 403);

  const reviewee_id = is_buyer ? tx.seller_id : tx.buyer_id;
  const reviewer_role = is_buyer ? "BUYER" : "SELLER";

  const existing = await Review.findOne({ transaction_id: id, reviewer_id: user_id }).lean();
  if (existing) throw new AppError("You have already reviewed this transaction", 409);

  const review = await Review.create({
    transaction_id: id,
    reviewer_id: user_id,
    reviewee_id,
    reviewer_role,
    rating,
    comment: comment ?? null,
  });

  await createNotification({
    user_id: reviewee_id,
    type: "REVIEW_RECEIVED",
    title: "New review received",
    body: `You received a ${rating}-star review`,
    related_transaction_id: id,
  }).catch(() => undefined);

  return sendSuccess({
    res,
    code: 201,
    message: "Review submitted",
    data: { review: formatReview(review) },
  });
});

export const getUserReviews = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const pagination = parsePaginationQuery(req.query);
  const where = { reviewee_id: userId };

  if (pagination.pagination_type === "cursor") {
    const items = await Review.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { reviews: items.slice(0, pagination.limit).map(formatReview) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Review.find(where).sort({ _id: -1 }).skip(skip).limit(pagination.limit).lean(),
    Review.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { reviews: items.map(formatReview) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});
