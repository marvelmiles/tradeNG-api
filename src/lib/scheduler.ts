import { schedule } from "node-cron";
import { Types } from "mongoose";
import { User } from "@/models/v1/user.model";
import { Transaction } from "@/models/v1/transaction.model";
import { VerificationReminder, ReminderType } from "@/models/v1/verification_reminder.model";
import { CategoryRequest } from "@/models/v1/category_request.model";
import { Category } from "@/models/v1/category.model";
import { WithdrawalRequest } from "@/models/v1/withdrawal_request.model";
import { WalletLedgerEntry } from "@/models/v1/wallet_ledger_entry.model";
import { Dispute } from "@/models/v1/dispute.model";
import { EmailService } from "@/api/v1/services/email.service";
import { recordEscrowRelease, recordEscrowReversal, recordWithdrawalReversal } from "@/api/v1/services/wallet.service";
import { createNotification } from "@/api/v1/services/notification.service";
import { escapeRegex } from "@/utils/slugify";

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
    .populate<{ seller_id: { _id: Types.ObjectId; email: string; first_name: string } }>("seller_id", "email first_name")
    .populate<{ listing_id: { item_name: string } }>("listing_id", "item_name")
    .lean();

  for (const tx of transactions) {
    try {
      const seller = tx.seller_id as { _id: Types.ObjectId; email: string; first_name: string };
      const listing = tx.listing_id as { item_name: string };

      await Transaction.findByIdAndUpdate(tx._id, { status: "RELEASED", released_at: now });
      await recordEscrowRelease(seller._id, tx._id, tx.seller_amount);

      await EmailService.sendPaymentReleased(
        seller.email,
        seller.first_name,
        listing.item_name,
        tx.seller_amount
      );

      await createNotification({
        user_id: seller._id,
        type: "PAYMENT_RELEASED",
        title: "Payment released",
        body: `₦${tx.seller_amount.toLocaleString()} for "${listing.item_name}" has been released to you`,
        related_transaction_id: tx._id,
      });

      console.log(`[Scheduler] Auto-released payment for transaction ${tx._id.toString()}`);
    } catch (err) {
      console.error(`[Scheduler] Failed to auto-release transaction ${tx._id.toString()}:`, err);
    }
  }
};

const reconcileCategoryRequests = async (): Promise<void> => {
  const pending_requests = await CategoryRequest.find({ status: "PENDING" })
    .populate<{ requested_by: { _id: Types.ObjectId; first_name: string; email: string } }>(
      "requested_by",
      "first_name email"
    )
    .lean();

  for (const request of pending_requests) {
    try {
      const requester = request.requested_by as unknown as { _id: Types.ObjectId; first_name: string; email: string };

      const matched_category = await Category.findOne({
        requested_by: requester._id,
        name: { $regex: new RegExp(`^${escapeRegex(request.name)}$`, "i") },
      }).lean();

      if (!matched_category) continue;

      await CategoryRequest.findByIdAndUpdate(request._id, {
        status: "APPROVED",
        resolved_category_id: matched_category._id,
      });

      await EmailService.sendCategoryApproved(requester.email, requester.first_name, matched_category.name);

      await createNotification({
        user_id: requester._id,
        type: "CATEGORY_REQUEST_APPROVED",
        title: "Category request approved",
        body: `The category "${matched_category.name}" you requested is now available`,
      });

      console.log(`[Scheduler] Category request ${request._id.toString()} approved`);
    } catch (err) {
      console.error(`[Scheduler] Failed to reconcile category request ${request._id.toString()}:`, err);
    }
  }
};

const reconcileWithdrawals = async (): Promise<void> => {
  const resolved_withdrawals = await WithdrawalRequest.find({ status: { $in: ["COMPLETED", "REJECTED"] } })
    .populate<{ user_id: { _id: Types.ObjectId; email: string; first_name: string } }>("user_id", "email first_name")
    .lean();

  for (const withdrawal of resolved_withdrawals) {
    try {
      const already_notified = await WalletLedgerEntry.exists({
        withdrawal_id: withdrawal._id,
        type: "WITHDRAWAL_REVERSAL",
      });

      if (withdrawal.status === "REJECTED" && !already_notified) {
        const user = withdrawal.user_id as { _id: Types.ObjectId; email: string; first_name: string };
        await recordWithdrawalReversal(user._id, withdrawal._id, withdrawal.amount);
        await EmailService.sendWithdrawalUpdate(user.email, user.first_name, withdrawal.amount, "REJECTED");
        await createNotification({
          user_id: user._id,
          type: "WITHDRAWAL_UPDATE",
          title: "Withdrawal rejected",
          body: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} was rejected and returned to your available balance`,
        });
        console.log(`[Scheduler] Reversed rejected withdrawal ${withdrawal._id.toString()}`);
      }
    } catch (err) {
      console.error(`[Scheduler] Failed to reconcile withdrawal ${withdrawal._id.toString()}:`, err);
    }
  }
};

const reconcileDisputes = async (): Promise<void> => {
  const resolved_disputes = await Dispute.find({ status: { $in: ["RESOLVED_BUYER", "RESOLVED_SELLER"] } }).lean();

  for (const dispute of resolved_disputes) {
    try {
      const tx = await Transaction.findById(dispute.transaction_id)
        .populate<{ buyer_id: { _id: Types.ObjectId; email: string; first_name: string } }>("buyer_id", "email first_name")
        .populate<{ seller_id: { _id: Types.ObjectId; email: string; first_name: string } }>("seller_id", "email first_name")
        .populate<{ listing_id: { item_name: string } }>("listing_id", "item_name")
        .lean();

      if (!tx || tx.status !== "DISPUTED") continue;

      const buyer = tx.buyer_id as { _id: Types.ObjectId; email: string; first_name: string };
      const seller = tx.seller_id as { _id: Types.ObjectId; email: string; first_name: string };
      const listing = tx.listing_id as { item_name: string };

      if (dispute.status === "RESOLVED_SELLER") {
        await Transaction.findByIdAndUpdate(tx._id, { status: "RELEASED", released_at: new Date() });
        await recordEscrowRelease(seller._id, tx._id, tx.seller_amount);
      } else {
        await Transaction.findByIdAndUpdate(tx._id, { status: "REFUNDED" });
        await recordEscrowReversal(seller._id, tx._id, tx.seller_amount);
      }

      await EmailService.sendDisputeResolved(buyer.email, buyer.first_name, listing.item_name, dispute.resolution_note);
      await EmailService.sendDisputeResolved(seller.email, seller.first_name, listing.item_name, dispute.resolution_note);

      await createNotification({
        user_id: buyer._id,
        type: "DISPUTE_RESOLVED",
        title: "Dispute resolved",
        body: `The dispute on "${listing.item_name}" has been resolved`,
        related_transaction_id: tx._id,
      });
      await createNotification({
        user_id: seller._id,
        type: "DISPUTE_RESOLVED",
        title: "Dispute resolved",
        body: `The dispute on "${listing.item_name}" has been resolved`,
        related_transaction_id: tx._id,
      });

      console.log(`[Scheduler] Reconciled resolved dispute ${dispute._id.toString()}`);
    } catch (err) {
      console.error(`[Scheduler] Failed to reconcile dispute ${dispute._id.toString()}:`, err);
    }
  }
};

const reconcileVerifiedSellers = async (): Promise<void> => {
  const newly_verified = await User.find({
    is_verified_seller: true,
    verification_requested_at: { $ne: null },
  })
    .select("email first_name")
    .lean();

  for (const user of newly_verified) {
    try {
      await User.findByIdAndUpdate(user._id, { verification_requested_at: null });
      await EmailService.sendVerifiedSellerApproved(user.email, user.first_name);
      await createNotification({
        user_id: user._id,
        type: "SELLER_VERIFIED",
        title: "You're a verified seller",
        body: "Your seller verification request has been approved",
      });
      console.log(`[Scheduler] Notified verified seller ${user._id.toString()}`);
    } catch (err) {
      console.error(`[Scheduler] Failed to notify verified seller ${user._id.toString()}:`, err);
    }
  }
};

export const startScheduler = (): void => {
  schedule("0 * * * *", async () => {
    console.log("[Scheduler] Running hourly tasks...");
    await Promise.allSettled([
      sendVerificationReminders(),
      deleteExpiredAccounts(),
      reconcileCategoryRequests(),
      reconcileWithdrawals(),
      reconcileDisputes(),
      reconcileVerifiedSellers(),
    ]);
  });

  schedule("*/30 * * * *", async () => {
    await autoReleasePayments();
  });

  console.log("[Scheduler] Started — reminders (hourly), category reconciliation (hourly), auto-release (every 30min)");
};
