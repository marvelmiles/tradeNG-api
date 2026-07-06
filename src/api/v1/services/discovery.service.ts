import { Types } from "mongoose";
import { Transaction } from "@/models/v1/transaction.model";

export interface TopSellerRanking {
  seller_id: Types.ObjectId;
  completed_sales: number;
  total_revenue: number;
}

// Ranks sellers by completed (RELEASED) sales, tie-broken by revenue.
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
