import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { parsePaginationQuery, buildPagePagination, buildCursorPagination } from "@/utils/pagination";
import { Listing } from "@/models/v1/listing.model";
import { User } from "@/models/v1/user.model";
import { getTopSellerRanking, resolveTopSellers, getPlatformStats } from "@/api/v1/services/discovery.service";
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
const STATS_TOP_SELLERS_PREVIEW_SIZE = 5;

export const getTopSellers = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit ?? DEFAULT_TOP_SELLERS_LIMIT), 10) || DEFAULT_TOP_SELLERS_LIMIT, 1),
    MAX_TOP_SELLERS_LIMIT,
  );

  const top_sellers = await resolveTopSellers(limit);

  return sendSuccess({ res, data: { top_sellers } });
});

export const getDiscoveryStats = asyncHandler(async (_req: Request, res: Response) => {
  const [stats, top_sellers] = await Promise.all([
    getPlatformStats(),
    resolveTopSellers(STATS_TOP_SELLERS_PREVIEW_SIZE),
  ]);

  return sendSuccess({
    res,
    data: {
      stats: {
        active_users: stats.active_users,
        verified_sellers: stats.verified_sellers,
        active_listings: stats.active_listings,
        completed_sales: stats.completed_sales,
        gross_sales_volume: stats.gross_sales_volume,
        review_average: stats.review_average,
        review_count: stats.review_count,
      },
      top_sellers,
    },
  });
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
