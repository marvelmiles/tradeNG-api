import { Request, Response } from "express";
import { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  parsePaginationQuery,
  buildPagePagination,
  buildCursorPagination,
  buildCursorFilter,
} from "@/utils/pagination";
import { Listing, IListing } from "@/models/v1/listing.model";
import { Bid } from "@/models/v1/bid.model";
import type { CreateListingInput, UpdateListingInput, ListingsQuery } from "@/api/v1/validators/listing";

type LeanUser = { _id: Types.ObjectId; first_name: string; last_name: string };

type LeanListing = Omit<IListing, "seller_id"> & {
  _id: Types.ObjectId;
  seller_id: Types.ObjectId | LeanUser;
};

const formatUser = (user: Types.ObjectId | LeanUser | null | undefined) => {
  if (!user || user instanceof Types.ObjectId) return null;
  return {
    id: user._id.toString(),
    first_name: user.first_name,
    last_name: user.last_name,
  };
};

const formatListing = (listing: LeanListing) => {
  const { _id, seller_id, ...rest } = listing;
  return {
    id: _id.toString(),
    ...rest,
    seller: formatUser(seller_id),
  };
};

export const createListing = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, condition, start_price, ends_at } = req.body as CreateListingInput;

  const doc = await Listing.create({
    title,
    description,
    condition,
    start_price,
    ends_at: ends_at ? new Date(ends_at) : null,
    seller_id: req.user!.id,
  });

  const listing = await Listing.findById(doc._id)
    .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
    .lean();

  return sendSuccess({
    res,
    code: 201,
    message: "Listing created successfully",
    data: { listing: formatListing(listing as unknown as LeanListing) },
  });
});

export const getListings = asyncHandler(async (req: Request, res: Response) => {
  const { q, condition, status } = req.query as unknown as ListingsQuery;
  const pagination = parsePaginationQuery(req.query);

  const baseWhere: Record<string, unknown> = {
    ...(condition && { condition }),
    status: status ?? "ACTIVE",
    ...(q ? { $text: { $search: q } } : {}),
  };

  if (pagination.pagination_type === "cursor") {
    const where = { ...baseWhere, ...buildCursorFilter(pagination.cursor) };

    const items = await Listing.find(where)
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
      .lean();

    const cast = items as unknown as LeanListing[];
    const paginationResult = buildCursorPagination(pagination.cursor, cast, pagination.limit);

    return sendSuccess({
      res,
      data: { listings: cast.slice(0, pagination.limit).map(formatListing) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Listing.find(baseWhere)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
      .lean(),
    Listing.countDocuments(baseWhere),
  ]);

  return sendSuccess({
    res,
    data: { listings: (items as unknown as LeanListing[]).map(formatListing) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const getListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const listing = await Listing.findById(id)
    .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
    .lean();

  if (!listing) throw new AppError("Listing not found", 404);

  const top_bids = await Bid.findOne
    ? await Bid.find({ listing_id: id, status: "PENDING" })
        .sort({ amount: -1 })
        .limit(5)
        .populate<{ bidder_id: LeanUser }>("bidder_id", "first_name last_name")
        .lean()
    : [];

  return sendSuccess({
    res,
    data: {
      listing: {
        ...formatListing(listing as unknown as LeanListing),
        top_bids: top_bids.map((b) => ({
          id: b._id.toString(),
          amount: b.amount,
          created_at: b.created_at,
          bidder: formatUser(b.bidder_id as unknown as LeanUser),
        })),
      },
    },
  });
});

export const updateListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body as UpdateListingInput;

  const existing = await Listing.findById(id).select("seller_id status").lean();

  if (!existing) throw new AppError("Listing not found", 404);
  if (existing.seller_id.toString() !== req.user!.id) throw new AppError("Forbidden", 403);
  if (existing.status !== "ACTIVE") throw new AppError("Only active listings can be updated", 400);

  const updated = await Listing.findByIdAndUpdate(
    id,
    {
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.condition !== undefined && { condition: updates.condition }),
      ...(updates.ends_at !== undefined && { ends_at: updates.ends_at ? new Date(updates.ends_at) : null }),
    },
    { new: true }
  )
    .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
    .lean();

  return sendSuccess({
    res,
    message: "Listing updated",
    data: { listing: formatListing(updated as unknown as LeanListing) },
  });
});

export const cancelListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const listing = await Listing.findById(id).select("seller_id status").lean();

  if (!listing) throw new AppError("Listing not found", 404);
  if (listing.seller_id.toString() !== req.user!.id) throw new AppError("Forbidden", 403);
  if (listing.status !== "ACTIVE") throw new AppError("Only active listings can be cancelled", 400);

  await Listing.findByIdAndUpdate(id, { status: "CANCELLED" });

  return sendSuccess({ res, message: "Listing cancelled" });
});

export const getMyListings = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const where = { seller_id: req.user!.id };

  if (pagination.pagination_type === "cursor") {
    const cursorWhere = { ...where, ...buildCursorFilter(pagination.cursor) };

    const items = await Listing.find(cursorWhere)
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
      .lean();

    const cast = items as unknown as LeanListing[];
    const paginationResult = buildCursorPagination(pagination.cursor, cast, pagination.limit);

    return sendSuccess({
      res,
      data: { listings: cast.slice(0, pagination.limit).map(formatListing) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Listing.find(where)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
      .lean(),
    Listing.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { listings: (items as unknown as LeanListing[]).map(formatListing) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});
