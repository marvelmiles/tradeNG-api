import { Router } from "express";
import authRoutes from "@/api/v1/routes/auth.routes";
import listingRoutes from "@/api/v1/routes/listing.routes";
import bidRoutes from "@/api/v1/routes/bid.routes";
import transactionRoutes from "@/api/v1/routes/transaction.routes";

const v1Router = Router();

v1Router.use("/auth", authRoutes);
v1Router.use("/listings", listingRoutes);
v1Router.use("/bids", bidRoutes);
v1Router.use("/transactions", transactionRoutes);

export default v1Router;
