import { Types } from "mongoose";
import { Transaction } from "@/models/v1/transaction.model";
import { User } from "@/models/v1/user.model";
import { Listing } from "@/models/v1/listing.model";
import { Review } from "@/models/v1/review.model";
import { getReviewSummary } from "@/api/v1/services/review.service";

export interface TopSellerRanking {
  seller_id: Types.ObjectId;
  completed_sales: number;
  total_revenue: number;
}

export const getTopSellerRanking = async (limit: number): Promise<TopSellerRanking[]> =>
  Transaction.aggregate<TopSellerRanking>([
    { $match: { status: "RELEASED" } },
    {
      $group: {
        _id: "$seller_id",
        completed_sales: { $sum: 1 },
        total_revenue: { $sum: "$seller_amount" },
      },
    },
    { $sort: { completed_sales: -1, total_revenue: -1 } },
    { $limit: limit },
    { $project: { _id: 0, seller_id: "$_id", completed_sales: 1, total_revenue: 1 } },
  ]);

export interface TopSeller {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo: string | null;
  is_verified_seller: boolean;
  completed_sales: number;
  total_revenue: number;
  review_average: number;
  review_count: number;
}

export const resolveTopSellers = async (limit: number): Promise<TopSeller[]> => {
  const ranking = await getTopSellerRanking(limit);
  if (ranking.length === 0) return [];

  const users = await User.find({
    _id: { $in: ranking.map((r) => r.seller_id) },
    status: "ACTIVE",
  })
    .select("first_name last_name profile_photo is_verified_seller")
    .lean();
  const users_by_id = new Map(users.map((u) => [u._id.toString(), u]));

  return Promise.all(
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
};

export interface PlatformStats {
  active_users: number;
  verified_sellers: number;
  active_listings: number;
  completed_sales: number;
  gross_sales_volume: number;
  review_average: number;
  review_count: number;
}

export const getPlatformStats = async (): Promise<PlatformStats> => {
  const [active_users, verified_sellers, active_listings, sales_result, review_result] = await Promise.all([
    User.countDocuments({ status: "ACTIVE" }),
    User.countDocuments({ status: "ACTIVE", is_verified_seller: true }),
    Listing.countDocuments({ status: "ACTIVE" }),
    Transaction.aggregate<{ _id: null; count: number; volume: number }>([
      { $match: { status: "RELEASED" } },
      { $group: { _id: null, count: { $sum: 1 }, volume: { $sum: "$amount" } } },
    ]),
    Review.aggregate<{ _id: null; avg: number; count: number }>([
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    active_users,
    verified_sellers,
    active_listings,
    completed_sales: sales_result[0]?.count ?? 0,
    gross_sales_volume: sales_result[0]?.volume ?? 0,
    review_average: review_result[0] ? parseFloat(review_result[0].avg.toFixed(2)) : 0,
    review_count: review_result[0]?.count ?? 0,
  };
};
