import { Types } from "mongoose";
import { Review } from "@/models/v1/review.model";

interface ReviewSummary {
  review_average: number;
  review_count: number;
}

export const getReviewSummary = async (user_id: string | Types.ObjectId): Promise<ReviewSummary> => {
  const [result] = await Review.aggregate<{ _id: null; avg: number; count: number }>([
    { $match: { reviewee_id: new Types.ObjectId(user_id) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  return {
    review_average: result ? parseFloat(result.avg.toFixed(2)) : 0,
    review_count: result?.count ?? 0,
  };
};
