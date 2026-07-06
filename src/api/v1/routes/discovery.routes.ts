import { Router } from "express";
import {
  getTopSellers,
  getFeaturedListings,
  getBestSellingListings,
  getRecentVerifiedSellerListings,
} from "@/api/v1/controllers/discovery.controller";

const router = Router();

router.get("/top-sellers", getTopSellers);
router.get("/featured-listings", getFeaturedListings);
router.get("/best-selling", getBestSellingListings);
router.get("/recent-from-verified-sellers", getRecentVerifiedSellerListings);

export default router;
