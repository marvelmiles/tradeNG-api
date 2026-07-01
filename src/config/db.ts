import mongoose from "mongoose";
import { env } from "@/config/env";

export const connectDB = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: "tradeng",
  });
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};
