import { createServer } from "http";
import "@/config/env";
import app from "@/app";
import { connectDB } from "@/config/db";
import { startScheduler } from "@/lib/scheduler";
import { initSocket } from "@/lib/socket";
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

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    const origin = env.SERVER_URL;
    console.log(`[Server] Running at ${origin}`);
    console.log(`[Server] API base: ${origin}/api/${env.API_VERSION}`);
    console.log(`[Server] Webhooks: ${origin}/api/webhooks/payment`);
    console.log(`[Server] API docs: ${origin}/api/docs`);
    console.log(`[Server] Socket.io ready for real-time chat`);
  });
};

main().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
