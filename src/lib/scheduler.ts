import { schedule } from "node-cron";
import { User } from "@/models/v1/user.model";
import { Transaction } from "@/models/v1/transaction.model";
import { Listing } from "@/models/v1/listing.model";
import { VerificationReminder, ReminderType } from "@/models/v1/verification_reminder.model";
import { EmailService } from "@/api/v1/services/email.service";

const REMINDER_SCHEDULE: { type: ReminderType; offset_ms: number }[] = [
  { type: "1h", offset_ms: 1 * 60 * 60 * 1000 },
  { type: "5h", offset_ms: 5 * 60 * 60 * 1000 },
  { type: "24h", offset_ms: 24 * 60 * 60 * 1000 },
  { type: "3d", offset_ms: 3 * 24 * 60 * 60 * 1000 },
  { type: "6d", offset_ms: 6 * 24 * 60 * 60 * 1000 },
];

const sendVerificationReminders = async (): Promise<void> => {
  const now = new Date();

  const unverified_users = await User.find({ status: "UNVERIFIED" })
    .select("first_name email created_at")
    .lean();

  for (const user of unverified_users) {
    const sent_reminders = await VerificationReminder.find({ user_id: user._id })
      .select("type")
      .lean();

    const sent_types = new Set(sent_reminders.map((r: { type: ReminderType }) => r.type));

    for (const { type, offset_ms } of REMINDER_SCHEDULE) {
      if (sent_types.has(type)) continue;

      const trigger_time = new Date(user.created_at.getTime() + offset_ms);
      if (now < trigger_time) continue;

      try {
        await EmailService.sendVerificationReminder({ first_name: user.first_name, email: user.email }, type);
        await VerificationReminder.create({ user_id: user._id, type });
      } catch (err) {
        console.error(`[Scheduler] Failed to send ${type} reminder to ${user.email}:`, err);
      }
    }
  }
};

const deleteExpiredAccounts = async (): Promise<void> => {
  const result = await User.deleteMany({ status: "UNVERIFIED", delete_at: { $lte: new Date() } });

  if (result.deletedCount > 0) {
    console.log(`[Scheduler] Deleted ${result.deletedCount} expired unverified account(s)`);
  }
};

const autoReleasePayments = async (): Promise<void> => {
  const now = new Date();

  const transactions = await Transaction.find({
    status: "RECEIPT_CONFIRMED",
    auto_release_at: { $lte: now },
  })
    .populate<{ seller_id: { email: string; first_name: string } }>("seller_id", "email first_name")
    .populate<{ listing_id: { title: string } }>("listing_id", "title")
    .lean();

  for (const tx of transactions) {
    try {
      await Transaction.findByIdAndUpdate(tx._id, { status: "RELEASED", released_at: now });

      const seller = tx.seller_id as { email: string; first_name: string };
      const listing = tx.listing_id as { title: string };

      await EmailService.sendPaymentReleased(
        seller.email,
        seller.first_name,
        listing.title,
        tx.seller_amount
      );

      console.log(`[Scheduler] Auto-released payment for transaction ${tx._id.toString()}`);
    } catch (err) {
      console.error(`[Scheduler] Failed to auto-release transaction ${tx._id.toString()}:`, err);
    }
  }
};

const endExpiredListings = async (): Promise<void> => {
  const result = await Listing.updateMany(
    { status: "ACTIVE", ends_at: { $lte: new Date() } },
    { status: "ENDED" }
  );

  if (result.modifiedCount > 0) {
    console.log(`[Scheduler] Ended ${result.modifiedCount} expired listing(s)`);
  }
};

export const startScheduler = (): void => {
  schedule("0 * * * *", async () => {
    console.log("[Scheduler] Running hourly tasks...");
    await Promise.allSettled([
      sendVerificationReminders(),
      deleteExpiredAccounts(),
      endExpiredListings(),
    ]);
  });

  schedule("*/30 * * * *", async () => {
    await autoReleasePayments();
  });

  console.log("[Scheduler] Started — reminders (hourly), auto-release (every 30min)");
};
