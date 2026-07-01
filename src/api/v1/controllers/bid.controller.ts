import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  parsePaginationQuery,
  buildPagePagination,
  buildCursorPagination,
  buildCursorFilter,
} from "@/utils/pagination";
import { Bid, IBid } from "@/models/v1/bid.model";
import { Listing } from "@/models/v1/listing.model";
import { Transaction } from "@/models/v1/transaction.model";
import { EmailService } from "@/api/v1/services/email.service";
import type { PlaceBidInput } from "@/api/v1/validators/bid";

type LeanUser = { _id: Types.ObjectId; first_name: string; last_name: string; email?: string };
type LeanListing = { _id: Types.ObjectId; title: string; condition: string; status: string; seller_id: Types.ObjectId | LeanUser };
type LeanBid = Omit<IBid, "listing_id" | "bidder_id"> & {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId | LeanListing;
  bidder_id: Types.ObjectId | LeanUser;
};

const formatBid = (bid: LeanBid) => {
  const { _id, listing_id, bidder_id, ...rest } = bid;

  const bidder =
    bidder_id && typeof bidder_id === "object" && "_id" in bidder_id && !(bidder_id instanceof Types.ObjectId)
      ? { id: (bidder_id as LeanUser)._id.toString(), first_name: (bidder_id as LeanUser).first_name, last_name: (bidder_id as LeanUser).last_name }
      : null;

  const listing =
    listing_id && typeof listing_id === "object" && "_id" in listing_id && !(listing_id instanceof Types.ObjectId)
      ? {
          id: (listing_id as LeanListing)._id.toString(),
          title: (listing_id as LeanListing).title,
          condition: (listing_id as LeanListing).condition,
          status: (listing_id as LeanListing).status,
        }
      : null;

  return {
    id: _id.toString(),
    ...rest,
    ...(bidder ? { bidder } : {}),
    ...(listing ? { listing } : {}),
  };
};

export const placeBid = asyncHandler(async (req: Request, res: Response) => {
  const { listingId } = req.params;
  const { amount } = req.body as PlaceBidInput;
  const bidder_id = req.user!.id;

  const listing = await Listing.findById(listingId)
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name last_name")
    .lean();

  if (!listing) throw new AppError("Listing not found", 404);
  if (listing.status !== "ACTIVE") throw new AppError("This listing is no longer accepting bids", 400);
  if (listing.seller_id._id.toString() === bidder_id) throw new AppError("You cannot bid on your own listing", 400);
  if (listing.ends_at && listing.ends_at < new Date()) {
    throw new AppError("Bidding has ended for this listing", 400);
  }

  const highest_bid = await Bid.findOne({ listing_id: listingId, status: "PENDING" })
    .sort({ amount: -1 })
    .select("amount")
    .lean();

  const floor = highest_bid ? highest_bid.amount : listing.start_price;

  if (amount <= floor) {
    throw new AppError(
      `Bid must be higher than current ${highest_bid ? "highest bid" : "starting price"} of ₦${floor.toLocaleString()}`,
      400
    );
  }

  const bid = await Bid.create({ listing_id: listingId, bidder_id, amount });

  const populated = await Bid.findById(bid._id)
    .populate<{ bidder_id: LeanUser }>("bidder_id", "first_name last_name")
    .lean();

  await EmailService.sendBidPlaced(
    listing.seller_id.email!,
    listing.seller_id.first_name,
    `${req.user!.first_name} ${req.user!.last_name}`,
    listing.title,
    amount
  );

  return sendSuccess({
    res,
    code: 201,
    message: "Bid placed successfully",
    data: { bid: formatBid(populated as unknown as LeanBid) },
  });
});

export const getListingBids = asyncHandler(async (req: Request, res: Response) => {
  const { listingId } = req.params;
  const pagination = parsePaginationQuery(req.query);

  const listing = await Listing.findById(listingId).select("_id").lean();
  if (!listing) throw new AppError("Listing not found", 404);

  const where = { listing_id: listingId, status: "PENDING" };

  if (pagination.pagination_type === "cursor") {
    const cursorFilter = buildCursorFilter(pagination.cursor);
    const items = await Bid.find({ ...where, ...cursorFilter })
      .sort({ amount: -1, _id: -1 })
      .limit(pagination.limit + 1)
      .populate<{ bidder_id: LeanUser }>("bidder_id", "first_name last_name")
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { bids: items.slice(0, pagination.limit).map((b) => formatBid(b as unknown as LeanBid)) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [bids, total] = await Promise.all([
    Bid.find(where)
      .sort({ amount: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate<{ bidder_id: LeanUser }>("bidder_id", "first_name last_name")
      .lean(),
    Bid.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { bids: bids.map((b) => formatBid(b as unknown as LeanBid)) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const acceptBid = asyncHandler(async (req: Request, res: Response) => {
  const { listingId, bidId } = req.params;

  const listing = await Listing.findById(listingId).select("title seller_id status").lean();

  if (!listing) throw new AppError("Listing not found", 404);
  if (listing.seller_id.toString() !== req.user!.id) throw new AppError("Forbidden", 403);
  if (listing.status !== "ACTIVE") throw new AppError("This listing is no longer active", 400);

  const bid = await Bid.findById(bidId)
    .populate<{ bidder_id: LeanUser }>("bidder_id", "email first_name")
    .lean();

  if (!bid) throw new AppError("Bid not found", 404);
  if (bid.listing_id.toString() !== listingId) throw new AppError("Bid does not belong to this listing", 400);
  if (bid.status !== "PENDING") throw new AppError("This bid is no longer available", 400);

  const amount = bid.amount;
  const platform_fee = parseFloat((amount * (env.PLATFORM_FEE_PERCENT / 100)).toFixed(2));
  const seller_amount = parseFloat((amount - platform_fee).toFixed(2));

  const session = await mongoose.startSession();
  let tx_id = "";

  try {
    session.startTransaction();

    const [transaction] = await Transaction.create(
      [{ listing_id: listingId, buyer_id: bid.bidder_id._id, seller_id: req.user!.id, amount, platform_fee, seller_amount }],
      { session }
    );
    tx_id = transaction._id.toString();

    await Listing.findByIdAndUpdate(listingId, { status: "SOLD" }, { session });
    await Bid.findByIdAndUpdate(bidId, { status: "ACCEPTED" }, { session });
    await Bid.updateMany(
      { listing_id: listingId, _id: { $ne: new mongoose.Types.ObjectId(bidId) }, status: "PENDING" },
      { status: "REJECTED" },
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  const transaction = await Transaction.findById(tx_id).lean();

  await EmailService.sendBidAccepted(
    bid.bidder_id.email!,
    bid.bidder_id.first_name,
    listing.title,
    amount,
    tx_id
  );

  return sendSuccess({
    res,
    code: 201,
    message: "Bid accepted. The buyer has been notified to complete payment.",
    data: {
      transaction: {
        id: tx_id,
        amount: transaction!.amount,
        platform_fee: transaction!.platform_fee,
        seller_amount: transaction!.seller_amount,
        status: transaction!.status,
        created_at: transaction!.created_at,
      },
    },
  });
});

export const getMyBids = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const where = { bidder_id: req.user!.id };

  if (pagination.pagination_type === "cursor") {
    const cursorFilter = buildCursorFilter(pagination.cursor);
    const items = await Bid.find({ ...where, ...cursorFilter })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate<{ listing_id: LeanListing }>("listing_id", "title condition status seller_id")
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { bids: items.slice(0, pagination.limit).map((b) => formatBid(b as unknown as LeanBid)) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [bids, total] = await Promise.all([
    Bid.find(where)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate<{ listing_id: LeanListing }>("listing_id", "title condition status seller_id")
      .lean(),
    Bid.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { bids: bids.map((b) => formatBid(b as unknown as LeanBid)) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const withdrawBid = asyncHandler(async (req: Request, res: Response) => {
  const { bidId } = req.params;

  const bid = await Bid.findById(bidId)
    .populate<{ listing_id: LeanListing }>("listing_id", "status")
    .lean();

  if (!bid) throw new AppError("Bid not found", 404);
  if (bid.bidder_id.toString() !== req.user!.id) throw new AppError("Forbidden", 403);
  if (bid.status !== "PENDING") throw new AppError("Only pending bids can be withdrawn", 400);

  const listing_status = (bid.listing_id as LeanListing).status;
  if (listing_status !== "ACTIVE") throw new AppError("Cannot withdraw bid on a non-active listing", 400);

  await Bid.findByIdAndUpdate(bidId, { status: "WITHDRAWN" });

  return sendSuccess({ res, message: "Bid withdrawn successfully" });
});
