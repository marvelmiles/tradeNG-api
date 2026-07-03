import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  parsePaginationQuery,
  buildPagePagination,
  buildCursorPagination,
  buildCursorFilter,
} from "@/utils/pagination";
import { Transaction, ITransaction } from "@/models/v1/transaction.model";

type LeanUser = { _id: Types.ObjectId; first_name: string; last_name: string };
type LeanListing = { _id: Types.ObjectId; item_name: string; images: string[] };

type LeanOrder = Omit<ITransaction, "listing_id" | "buyer_id" | "seller_id"> & {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId | LeanListing;
  buyer_id: Types.ObjectId | LeanUser;
  seller_id: Types.ObjectId | LeanUser;
};

const buildTimeline = (order: LeanOrder) => {
  const timeline: { state: string; label: string; at: Date | null }[] = [
    { state: "PAID", label: "Payment held in escrow", at: order.status === "PENDING_PAYMENT" ? null : order.created_at },
    { state: "RECEIPT_CONFIRMED", label: "Buyer confirmed delivery", at: order.receipt_confirmed_at },
    { state: "RELEASED", label: "Payment released to seller", at: order.released_at },
  ];

  return timeline;
};

const formatOrder = (order: LeanOrder) => {
  const { _id, listing_id, buyer_id, seller_id, ...rest } = order;

  const listing =
    listing_id && !(listing_id instanceof Types.ObjectId)
      ? { id: (listing_id as LeanListing)._id.toString(), item_name: (listing_id as LeanListing).item_name, images: (listing_id as LeanListing).images }
      : null;

  const buyer =
    buyer_id && !(buyer_id instanceof Types.ObjectId)
      ? { id: (buyer_id as LeanUser)._id.toString(), first_name: (buyer_id as LeanUser).first_name, last_name: (buyer_id as LeanUser).last_name }
      : null;

  const seller =
    seller_id && !(seller_id instanceof Types.ObjectId)
      ? { id: (seller_id as LeanUser)._id.toString(), first_name: (seller_id as LeanUser).first_name, last_name: (seller_id as LeanUser).last_name }
      : null;

  return {
    id: _id.toString(),
    ...rest,
    dispute_id: rest.dispute_id?.toString() ?? null,
    ...(listing ? { listing } : {}),
    ...(buyer ? { buyer } : {}),
    ...(seller ? { seller } : {}),
    timeline: buildTimeline(order),
  };
};

const getOrders = async (req: Request, res: Response, role: "buyer" | "seller") => {
  const where = { [role === "buyer" ? "buyer_id" : "seller_id"]: req.user!.id };
  const pagination = parsePaginationQuery(req.query);

  const populateOptions = [
    { path: "listing_id", select: "item_name images" },
    { path: "buyer_id", select: "first_name last_name" },
    { path: "seller_id", select: "first_name last_name" },
  ];

  if (pagination.pagination_type === "cursor") {
    const items = await Transaction.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate(populateOptions)
      .lean();

    const cast = items as unknown as LeanOrder[];
    const paginationResult = buildCursorPagination(pagination.cursor, cast, pagination.limit);

    return sendSuccess({
      res,
      data: { orders: cast.slice(0, pagination.limit).map(formatOrder) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Transaction.find(where)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate(populateOptions)
      .lean(),
    Transaction.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { orders: (items as unknown as LeanOrder[]).map(formatOrder) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
};

export const getBuyingOrders = asyncHandler((req: Request, res: Response) => getOrders(req, res, "buyer"));
export const getSellingOrders = asyncHandler((req: Request, res: Response) => getOrders(req, res, "seller"));
