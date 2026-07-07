import { Request, Response } from "express";
import bcrypt from "bcryptjs";
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
import { User } from "@/models/v1/user.model";
import { Listing } from "@/models/v1/listing.model";
import { Transaction } from "@/models/v1/transaction.model";
import { WishlistItem } from "@/models/v1/wishlist.model";
import { getReviewSummary } from "@/api/v1/services/review.service";
import type {
  UpdateProfileInput,
  UpdatePasswordInput,
  UpdateNotificationSettingsInput,
} from "@/api/v1/validators/profile";

const formatUser = (user: {
  _id: { toString(): string };
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  about: string | null;
  address: string | null;
  profile_photo: string | null;
  role: string;
  is_verified_seller: boolean;
  notification_settings: unknown;
  created_at: Date;
}) => ({
  id: user._id.toString(),
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  phone_number: user.phone_number,
  about: user.about,
  address: user.address,
  profile_photo: user.profile_photo,
  role: user.role,
  is_verified_seller: user.is_verified_seller,
  notification_settings: user.notification_settings,
  created_at: user.created_at,
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user) throw new AppError("Account not found", 404);

  return sendSuccess({ res, data: { user: formatUser(user) } });
});

export const getUserPublicProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    const user = await User.findOne({ _id: userId, status: { $ne: "DELETED" } })
      .select(
        "first_name last_name about profile_photo is_verified_seller role created_at",
      )
      .lean();
    if (!user) throw new AppError("User not found", 404);

    let role = user.role || (user.is_verified_seller ? "SELLER" : "BUYER");
    if (!role) {
      const has_active_listing = await Listing.exists({
        seller_id: user._id,
        status: "ACTIVE",
      });
      role = has_active_listing ? "SELLER" : "BUYER";
      if (has_active_listing)
        await User.updateOne({ _id: user._id }, { role: "SELLER" });
    }

    const review_summary = await getReviewSummary(user._id);

    return sendSuccess({
      res,
      data: {
        user: {
          id: user._id.toString(),
          first_name: user.first_name,
          last_name: user.last_name,
          about: user.about,
          profile_photo: user.profile_photo,
          role,
          is_verified_seller: user.is_verified_seller,
          review_average: review_summary.review_average,
          review_count: review_summary.review_count,
          created_at: user.created_at,
        },
      },
    });
  },
);

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const updates = req.body as UpdateProfileInput;

  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { ...updates },
    { new: true },
  ).lean();
  if (!user) throw new AppError("Account not found", 404);

  return sendSuccess({
    res,
    message: "Profile updated",
    data: { user: formatUser(user) },
  });
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const user_id = req.user!.id;

  const [total_listings, items_sold, review_summary, earnings_result] =
    await Promise.all([
      Listing.countDocuments({ seller_id: user_id, status: { $ne: "DRAFT" } }),
      Transaction.countDocuments({ seller_id: user_id, status: "RELEASED" }),
      getReviewSummary(user_id),
      Transaction.aggregate<{ _id: null; total: number }>([
        {
          $match: {
            seller_id: new Types.ObjectId(user_id),
            status: "RELEASED",
          },
        },
        { $group: { _id: null, total: { $sum: "$seller_amount" } } },
      ]),
    ]);

  return sendSuccess({
    res,
    data: {
      total_listings,
      items_sold,
      avg_rating: review_summary.review_average,
      earnings: earnings_result[0]?.total ?? 0,
    },
  });
});

export const getTrustScore = asyncHandler(
  async (req: Request, res: Response) => {
    const user_id = req.user!.id;

    const user = await User.findById(user_id)
      .select("is_verified_seller status created_at")
      .lean();
    if (!user) throw new AppError("Account not found", 404);

    const [
      review_summary,
      completed_as_seller,
      completed_total,
      disputes_as_seller,
    ] = await Promise.all([
      getReviewSummary(user_id),
      Transaction.countDocuments({ seller_id: user_id, status: "RELEASED" }),
      Transaction.countDocuments({
        status: "RELEASED",
        $or: [{ buyer_id: user_id }, { seller_id: user_id }],
      }),
      Transaction.countDocuments({ seller_id: user_id, status: "DISPUTED" }),
    ]);

    const account_age_days = Math.floor(
      (Date.now() - user.created_at.getTime()) / (24 * 60 * 60 * 1000),
    );
    const dispute_rate =
      completed_as_seller > 0 ? disputes_as_seller / completed_as_seller : 0;
    const verification_status = user.is_verified_seller
      ? "SELLER_VERIFIED"
      : "EMAIL_VERIFIED";

    const score = Math.max(
      0,
      Math.min(
        100,
        (review_summary.review_average / 5) * 40 +
          Math.min(completed_total / 20, 1) * 25 +
          (user.is_verified_seller ? 15 : 5) +
          Math.min(account_age_days / 180, 1) * 10 -
          dispute_rate * 30,
      ),
    );

    return sendSuccess({
      res,
      data: {
        verification_status,
        review_average: review_summary.review_average,
        review_count: review_summary.review_count,
        completed_transactions_count: completed_total,
        account_age_days,
        dispute_rate: parseFloat(dispute_rate.toFixed(2)),
        score: Math.round(score),
      },
    });
  },
);

export const requestVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id)
      .select("is_verified_seller verification_requested_at")
      .lean();
    if (!user) throw new AppError("Account not found", 404);
    if (user.is_verified_seller)
      throw new AppError("You are already a verified seller", 409);
    if (user.verification_requested_at)
      throw new AppError("Verification request already pending review", 409);

    await User.findByIdAndUpdate(req.user!.id, {
      verification_requested_at: new Date(),
    });

    return sendSuccess({
      res,
      message: "Verification request submitted. We'll review and notify you.",
    });
  },
);

export const updatePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { current_password, new_password } = req.body as UpdatePasswordInput;

    const user = await User.findById(req.user!.id).select("password").lean();
    if (!user) throw new AppError("Account not found", 404);

    const match = await bcrypt.compare(current_password, user.password);
    if (!match) throw new AppError("Current password is incorrect", 401);

    const hashed = await bcrypt.hash(new_password, 12);
    await User.findByIdAndUpdate(req.user!.id, { password: hashed });

    return sendSuccess({ res, message: "Password updated successfully" });
  },
);

export const updateNotificationSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const updates = req.body as UpdateNotificationSettingsInput;

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      {
        ...(updates.email_general !== undefined && {
          "notification_settings.email_general": updates.email_general,
        }),
        ...(updates.email_offers !== undefined && {
          "notification_settings.email_offers": updates.email_offers,
        }),
        ...(updates.in_app_general !== undefined && {
          "notification_settings.in_app_general": updates.in_app_general,
        }),
        ...(updates.in_app_offers !== undefined && {
          "notification_settings.in_app_offers": updates.in_app_offers,
        }),
      },
      { new: true },
    )
      .select("notification_settings")
      .lean();

    return sendSuccess({
      res,
      message: "Notification settings updated",
      data: { notification_settings: user?.notification_settings },
    });
  },
);

export const deleteAccount = asyncHandler(
  async (req: Request, res: Response) => {
    await User.findByIdAndUpdate(req.user!.id, { status: "DELETED" });
    return sendSuccess({ res, message: "Account deleted" });
  },
);

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const where = { user_id: req.user!.id };

  const populateOptions = [
    { path: "listing_id", select: "item_name images price status" },
  ];

  if (pagination.pagination_type === "cursor") {
    const items = await WishlistItem.find({
      ...where,
      ...buildCursorFilter(pagination.cursor),
    })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate(populateOptions)
      .lean();

    const paginationResult = buildCursorPagination(
      pagination.cursor,
      items,
      pagination.limit,
    );

    return sendSuccess({
      res,
      data: {
        wishlist: items
          .slice(0, pagination.limit)
          .map((w) => ({ id: w._id.toString(), listing: w.listing_id })),
      },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    WishlistItem.find(where)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate(populateOptions)
      .lean(),
    WishlistItem.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: {
      wishlist: items.map((w) => ({
        id: w._id.toString(),
        listing: w.listing_id,
      })),
    },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const addToWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    const { listingId } = req.params;
    const user_id = req.user!.id;

    const listing = await Listing.findById(listingId).select("_id").lean();
    if (!listing) throw new AppError("Listing not found", 404);

    const existing = await WishlistItem.findOne({
      user_id,
      listing_id: listingId,
    }).lean();
    if (existing) return sendSuccess({ res, message: "Already in wishlist" });

    await WishlistItem.create({ user_id, listing_id: listingId });

    return sendSuccess({ res, code: 201, message: "Added to wishlist" });
  },
);

export const removeFromWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    const { listingId } = req.params;
    await WishlistItem.deleteOne({
      user_id: req.user!.id,
      listing_id: listingId,
    });

    return sendSuccess({ res, message: "Removed from wishlist" });
  },
);
