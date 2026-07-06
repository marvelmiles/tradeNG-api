import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { parsePaginationQuery, buildPagePagination, buildCursorPagination } from "@/utils/pagination";
import { Listing } from "@/models/v1/listing.model";
import { User } from "@/models/v1/user.model";
import { getReviewSummary } from "@/api/v1/services/review.service";
import { getTopSellerRanking } from "@/api/v1/services/discovery.service";
import {
  formatListing,
  paginateListingsByRecency,
  SELLER_POPULATE,
  CATEGORY_POPULATE,
  LeanListing,
} from "@/api/v1/controllers/listing.controller";

const DEFAULT_TOP_SELLERS_LIMIT = 10;
const MAX_TOP_SELLERS_LIMIT = 50;
const FEATURED_SELLER_POOL_SIZE = 20;

export const getTopSellers = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit ?? DEFAULT_TOP_SELLERS_LIMIT), 10) || DEFAULT_TOP_SELLERS_LIMIT, 1),
    MAX_TOP_SELLERS_LIMIT,
  );

  const ranking = await getTopSellerRanking(limit);
  if (ranking.length === 0) {
    return sendSuccess({ res, data: { top_sellers: [] } });
  }

  const users = await User.find({
    _id: { $in: ranking.map((r) => r.seller_id) },
    status: "ACTIVE",
  })
    .select("first_name last_name profile_photo is_verified_seller")
    .lean();
  const users_by_id = new Map(users.map((u) => [u._id.toString(), u]));

  const top_sellers = await Promise.all(
    ranking
      .filter((r) => users_by_id.has(r.seller_id.toString()))
      .map(async (r) => {
        const user = users_by_id.get(r.seller_id.toString())!;
        const review_summary = await getReviewSummary(r.seller_id);

        return {
          id: user._id.toString(),
          first_name: user.first_name,
          last_name: user.last_name,
          profile_photo: user.profile_photo,
          is_verified_seller: user.is_verified_seller,
          completed_sales: r.completed_sales,
          total_revenue: r.total_revenue,
          review_average: review_summary.review_average,
          review_count: review_summary.review_count,
        };
      }),
  );

  return sendSuccess({ res, data: { top_sellers } });
});

export const getFeaturedListings = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);

  const ranking = await getTopSellerRanking(FEATURED_SELLER_POOL_SIZE);
  const seller_ids = ranking.map((r) => r.seller_id);

  if (seller_ids.length === 0) {
    return sendSuccess({
      res,
      data: { listings: [] },
      pagination:
        pagination.pagination_type === "cursor"
          ? buildCursorPagination(pagination.cursor, [], pagination.limit, 0)
          : buildPagePagination(pagination.page, pagination.limit, 0),
    });
  }

  const where = { status: "ACTIVE", seller_id: { $in: seller_ids } };
  const { listings, pagination: paginationResult } = await paginateListingsByRecency(where, pagination);

  return sendSuccess({ res, data: { listings }, pagination: paginationResult });
});

export const getBestSellingListings = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const page = pagination.pagination_type === "page" ? pagination.page : 1;
  const limit = pagination.limit;

  const where = { status: "ACTIVE" };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Listing.find(where)
      .sort({ view_count: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate(SELLER_POPULATE)
      .populate(CATEGORY_POPULATE)
      .lean(),
    Listing.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { listings: (items as unknown as LeanListing[]).map(formatListing) },
    pagination: buildPagePagination(page, limit, total),
  });
});

export const getRecentVerifiedSellerListings = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);

  const verified_sellers = await User.find({ is_verified_seller: true }).select("_id").lean();
  const where = { status: "ACTIVE", seller_id: { $in: verified_sellers.map((s) => s._id) } };

  const { listings, pagination: paginationResult } = await paginateListingsByRecency(where, pagination);

  return sendSuccess({ res, data: { listings }, pagination: paginationResult });
});
