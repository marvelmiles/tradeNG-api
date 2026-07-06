import { Router } from "express";
import authRoutes from "@/api/v1/routes/auth.routes";
import listingRoutes from "@/api/v1/routes/listing.routes";
import offerRoutes from "@/api/v1/routes/offer.routes";
import transactionRoutes from "@/api/v1/routes/transaction.routes";
import categoryRoutes from "@/api/v1/routes/category.routes";
import uploadRoutes from "@/api/v1/routes/upload.routes";
import walletRoutes from "@/api/v1/routes/wallet.routes";
import orderRoutes from "@/api/v1/routes/order.routes";
import conversationRoutes from "@/api/v1/routes/conversation.routes";
import notificationRoutes from "@/api/v1/routes/notification.routes";
import profileRoutes from "@/api/v1/routes/profile.routes";
import userRoutes from "@/api/v1/routes/user.routes";
import supportRoutes from "@/api/v1/routes/support.routes";
import discoveryRoutes from "@/api/v1/routes/discovery.routes";

const v1Router = Router();

v1Router.use("/auth", authRoutes);
v1Router.use("/listings", listingRoutes);
v1Router.use("/offers", offerRoutes);
v1Router.use("/transactions", transactionRoutes);
v1Router.use("/categories", categoryRoutes);
v1Router.use("/uploads", uploadRoutes);
v1Router.use("/wallet", walletRoutes);
v1Router.use("/orders", orderRoutes);
v1Router.use("/conversations", conversationRoutes);
v1Router.use("/notifications", notificationRoutes);
v1Router.use("/profile", profileRoutes);
v1Router.use("/users", userRoutes);
v1Router.use("/support", supportRoutes);
v1Router.use("/discovery", discoveryRoutes);

export default v1Router;
