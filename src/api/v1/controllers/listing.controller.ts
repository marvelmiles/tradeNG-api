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
import { User } from "@/models/v1/user.model";
import { createTransactionForSale } from "@/api/v1/services/transaction.service";
import type { CreateListingInput, UpdateListingInput, ListingsQuery } from "@/api/v1/validators/listing";

type LeanUser = { _id: Types.ObjectId; first_name: string; last_name: string; email?: string; is_verified_seller?: boolean };
type LeanCategory = { _id: Types.ObjectId; name: string; slug: string };

type LeanListing = Omit<IListing, "seller_id" | "category_id"> & {
  _id: Types.ObjectId;
  seller_id: Types.ObjectId | LeanUser;
  category_id: Types.ObjectId | LeanCategory;
};

const formatUser = (user: Types.ObjectId | LeanUser | null | undefined) => {
  if (!user || user instanceof Types.ObjectId) return null;
  return {
    id: user._id.toString(),
    first_name: user.first_name,
    last_name: user.last_name,
    is_verified_seller: user.is_verified_seller ?? false,
  };
};

const formatCategory = (category: Types.ObjectId | LeanCategory | null | undefined) => {
  if (!category || category instanceof Types.ObjectId) return null;
  return { id: category._id.toString(), name: category.name, slug: category.slug };
};

const formatListing = (listing: LeanListing) => {
  const { _id, seller_id, category_id, ...rest } = listing;
  return {
    id: _id.toString(),
    ...rest,
    seller: formatUser(seller_id),
    category: formatCategory(category_id),
  };
};

const SELLER_POPULATE = { path: "seller_id", select: "first_name last_name is_verified_seller" };
const CATEGORY_POPULATE = { path: "category_id", select: "name slug" };

export const createListing = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateListingInput;

  const doc = await Listing.create({
    item_name: input.item_name,
    category_id: input.category_id,
    condition: input.condition,
    defect_description: input.defect_description ?? null,
    description: input.description,
    images: input.images ?? [],
    video: input.video ?? null,
    price: input.price,
    allow_price_negotiation: input.allow_price_negotiation,
    delivery_options: input.delivery_options,
    pickup_address: input.pickup_address ?? null,
    location: input.location ?? null,
    status: input.status,
    seller_id: req.user!.id,
  });

  const listing = await Listing.findById(doc._id).populate(SELLER_POPULATE).populate(CATEGORY_POPULATE).lean();

  return sendSuccess({
    res,
    code: 201,
    message: input.status === "ACTIVE" ? "Listing published successfully" : "Listing saved as draft",
    data: { listing: formatListing(listing as unknown as LeanListing) },
  });
});

export const publishListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const listing = await Listing.findById(id).lean();
  if (!listing) throw new AppError("Listing not found", 404);
  if (listing.seller_id.toString() !== req.user!.id) throw new AppError("Forbidden", 403);
  if (listing.status !== "DRAFT") throw new AppError("Only draft listings can be published", 400);
  if (!listing.images || listing.images.length === 0) {
    throw new AppError("At least one image is required to publish this listing", 400);
  }

  const updated = await Listing.findByIdAndUpdate(id, { status: "ACTIVE" }, { new: true })
    .populate(SELLER_POPULATE)
    .populate(CATEGORY_POPULATE)
    .lean();

  return sendSuccess({
    res,
    message: "Listing published successfully",
    data: { listing: formatListing(updated as unknown as LeanListing) },
  });
});

const buildListingFilters = async (query: ListingsQuery): Promise<Record<string, unknown>> => {
  const { q, category_id, condition, min_price, max_price, location, verified_sellers_only, status } = query;

  const where: Record<string, unknown> = {
    status: status ?? "ACTIVE",
    ...(category_id && { category_id }),
    ...(condition && { condition }),
    ...(location && { location: { $regex: location, $options: "i" } }),
    ...(q ? { $text: { $search: q } } : {}),
  };

  if (min_price !== undefined || max_price !== undefined) {
    where.price = {
      ...(min_price !== undefined && { $gte: min_price }),
      ...(max_price !== undefined && { $lte: max_price }),
    };
  }

  if (verified_sellers_only) {
    const verified_sellers = await User.find({ is_verified_seller: true }).select("_id").lean();
    where.seller_id = { $in: verified_sellers.map((s) => s._id) };
  }

  return where;
};

export const getListings = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListingsQuery;
  const pagination = parsePaginationQuery(req.query);
  const baseWhere = await buildListingFilters(query);

  if (pagination.pagination_type === "cursor") {
    const where = { ...baseWhere, ...buildCursorFilter(pagination.cursor) };

    const items = await Listing.find(where)
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate(SELLER_POPULATE)
      .populate(CATEGORY_POPULATE)
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
      .populate(SELLER_POPULATE)
      .populate(CATEGORY_POPULATE)
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

  const listing = await Listing.findByIdAndUpdate(id, { $inc: { view_count: 1 } }, { new: true })
    .populate(SELLER_POPULATE)
    .populate(CATEGORY_POPULATE)
    .lean();

  if (!listing) throw new AppError("Listing not found", 404);

  return sendSuccess({
    res,
    data: { listing: formatListing(listing as unknown as LeanListing) },
  });
});

export const updateListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body as UpdateListingInput;

  const existing = await Listing.findById(id).select("seller_id status").lean();

  if (!existing) throw new AppError("Listing not found", 404);
  if (existing.seller_id.toString() !== req.user!.id) throw new AppError("Forbidden", 403);
  if (existing.status !== "DRAFT" && existing.status !== "ACTIVE") {
    throw new AppError("Only draft or active listings can be updated", 400);
  }

  const updated = await Listing.findByIdAndUpdate(id, { ...updates }, { new: true })
    .populate(SELLER_POPULATE)
    .populate(CATEGORY_POPULATE)
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
  if (listing.status !== "ACTIVE" && listing.status !== "DRAFT") {
    throw new AppError("Only draft or active listings can be cancelled", 400);
  }

  await Listing.findByIdAndUpdate(id, { status: "CANCELLED" });

  return sendSuccess({ res, message: "Listing cancelled" });
});

export const buyListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const buyer_id = req.user!.id;

  const listing = await Listing.findById(id)
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name last_name")
    .lean();

  if (!listing) throw new AppError("Listing not found", 404);

  const seller = listing.seller_id as LeanUser;

  const transaction = await createTransactionForSale(
    { _id: listing._id, status: listing.status, seller_id: seller._id, price: listing.price },
    buyer_id,
    listing.price
  );

  return sendSuccess({
    res,
    code: 201,
    message: "Purchase started. Proceed to checkout to complete payment.",
    data: {
      transaction: {
        id: transaction._id.toString(),
        amount: transaction.amount,
        platform_fee: transaction.platform_fee,
        seller_amount: transaction.seller_amount,
        status: transaction.status,
        created_at: transaction.created_at,
      },
    },
  });
});

export const getMyListings = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const status = req.query.status as string | undefined;
  const where = { seller_id: req.user!.id, ...(status && { status }) };

  if (pagination.pagination_type === "cursor") {
    const items = await Listing.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate(SELLER_POPULATE)
      .populate(CATEGORY_POPULATE)
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
      .populate(SELLER_POPULATE)
      .populate(CATEGORY_POPULATE)
      .lean(),
    Listing.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { listings: (items as unknown as LeanListing[]).map(formatListing) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});
