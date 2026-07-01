import "@/config/env";
import app from "@/app";
import { connectDB } from "@/config/db";
import { startScheduler } from "@/lib/scheduler";
import { env } from "@/config/env";

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const main = async (): Promise<void> => {
  await connectDB();
  console.log("[DB] Connected to MongoDB");

  startScheduler();

  app.listen(env.PORT, () => {
    const origin = env.APP_URL;
    console.log(`[Server] Running at ${origin}`);
    console.log(`[Server] API base: ${origin}/api/${env.API_VERSION}`);
    console.log(`[Server] Webhooks: ${origin}/api/webhooks/payment`);
    console.log(`[Server] API docs: ${origin}/api/docs`);
  });
};

main().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
