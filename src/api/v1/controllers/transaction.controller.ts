import { Request, Response } from "express";
import { Types } from "mongoose";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  parsePaginationQuery,
  buildPagePagination,
  buildCursorPagination,
  buildCursorFilter,
} from "@/utils/pagination";
import { Transaction, ITransaction } from "@/models/v1/transaction.model";
import { EmailService } from "@/api/v1/services/email.service";
import type { InitiatePaymentInput, DisputeInput } from "@/api/v1/validators/transaction";

type LeanUser = { _id: Types.ObjectId; first_name: string; last_name: string; email?: string };
type LeanListing = { _id: Types.ObjectId; title: string; condition: string };

type LeanTransaction = Omit<ITransaction, "listing_id" | "buyer_id" | "seller_id"> & {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId | LeanListing;
  buyer_id: Types.ObjectId | LeanUser;
  seller_id: Types.ObjectId | LeanUser;
};

const formatTransaction = (tx: LeanTransaction) => {
  const { _id, listing_id, buyer_id, seller_id, ...rest } = tx;

  const listing =
    listing_id && !(listing_id instanceof Types.ObjectId)
      ? { id: (listing_id as LeanListing)._id.toString(), title: (listing_id as LeanListing).title, condition: (listing_id as LeanListing).condition }
      : null;

  const buyer =
    buyer_id && !(buyer_id instanceof Types.ObjectId)
      ? { id: (buyer_id as LeanUser)._id.toString(), first_name: (buyer_id as LeanUser).first_name, last_name: (buyer_id as LeanUser).last_name }
      : null;

  const seller =
    seller_id && !(seller_id instanceof Types.ObjectId)
      ? { id: (seller_id as LeanUser)._id.toString(), first_name: (seller_id as LeanUser).first_name, last_name: (seller_id as LeanUser).last_name }
      : null;

  return {
    id: _id.toString(),
    ...rest,
    ...(listing ? { listing } : {}),
    ...(buyer ? { buyer } : {}),
    ...(seller ? { seller } : {}),
  };
};

export const getTransaction = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;

  const tx = await Transaction.findById(id)
    .populate<{ listing_id: LeanListing }>("listing_id", "title condition")
    .populate<{ buyer_id: LeanUser }>("buyer_id", "first_name last_name")
    .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
    .lean();

  if (!tx) throw new AppError("Transaction not found", 404);

  const buyer_id = (tx.buyer_id as LeanUser)._id.toString();
  const seller_id = (tx.seller_id as LeanUser)._id.toString();

  if (buyer_id !== user_id && seller_id !== user_id) {
    throw new AppError("Forbidden", 403);
  }

  return sendSuccess({
    res,
    data: { transaction: formatTransaction(tx as unknown as LeanTransaction) },
  });
});

export const getMyTransactions = asyncHandler(async (req: Request, res: Response) => {
  const user_id = req.user!.id;
  const role = (req.query.role as string) ?? "both";
  const pagination = parsePaginationQuery(req.query);

  const baseWhere =
    role === "buyer"
      ? { buyer_id: user_id }
      : role === "seller"
      ? { seller_id: user_id }
      : { $or: [{ buyer_id: user_id }, { seller_id: user_id }] };

  const populateOptions = [
    { path: "listing_id", select: "title condition" },
    { path: "buyer_id", select: "first_name last_name" },
    { path: "seller_id", select: "first_name last_name" },
  ];

  if (pagination.pagination_type === "cursor") {
    const cursorFilter = buildCursorFilter(pagination.cursor);
    const items = await Transaction.find({ ...baseWhere, ...cursorFilter })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate(populateOptions)
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { transactions: items.slice(0, pagination.limit).map((t: unknown) => formatTransaction(t as LeanTransaction)) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [transactions, total] = await Promise.all([
    Transaction.find(baseWhere)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate(populateOptions)
      .lean(),
    Transaction.countDocuments(baseWhere),
  ]);

  return sendSuccess({
    res,
    data: { transactions: transactions.map((t: unknown) => formatTransaction(t as LeanTransaction)) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const initiatePayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { payment_ref } = req.body as InitiatePaymentInput;
  const user_id = req.user!.id;

  const tx = await Transaction.findById(id)
    .populate<{ listing_id: LeanListing }>("listing_id", "title")
    .lean();

  if (!tx) throw new AppError("Transaction not found", 404);
  if (tx.buyer_id.toString() !== user_id) throw new AppError("Forbidden", 403);
  if (tx.status !== "PENDING_PAYMENT") {
    throw new AppError("Payment has already been initiated or completed", 400);
  }

  await Transaction.findByIdAndUpdate(id, { payment_ref });

  return sendSuccess({
    res,
    message: "Payment reference recorded. Complete payment via your payment provider.",
    data: {
      transaction_id: id,
      payment_ref,
      amount: tx.amount,
      listing_title: (tx.listing_id as LeanListing).title,
      instructions:
        "Send payment using the reference above via your payment provider. The platform will confirm and hold funds in escrow.",
    },
  });
});

export const confirmPayment = asyncHandler(async (req: Request, res: Response) => {
  const { payment_ref } = req.body as { payment_ref: string };

  if (!payment_ref) throw new AppError("payment_ref is required", 400);

  const tx = await Transaction.findOne({ payment_ref })
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "title")
    .lean();

  if (!tx) throw new AppError("Transaction not found for this payment reference", 404);
  if (tx.status !== "PENDING_PAYMENT") {
    throw new AppError("Transaction is not in pending payment state", 400);
  }

  await Transaction.findByIdAndUpdate(tx._id, { status: "PAID" });

  const seller = tx.seller_id as LeanUser;
  const listing = tx.listing_id as LeanListing;

  await EmailService.sendPaymentReceived(
    seller.email!,
    seller.first_name,
    listing.title,
    tx.seller_amount,
    tx._id.toString()
  );

  return sendSuccess({
    res,
    message: "Payment confirmed. Seller has been notified to ship the item.",
    data: { transaction_id: tx._id.toString(), status: "PAID" },
  });
});

export const confirmReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;

  const tx = await Transaction.findById(id)
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "title")
    .lean();

  if (!tx) throw new AppError("Transaction not found", 404);
  if (tx.buyer_id.toString() !== user_id) throw new AppError("Forbidden", 403);
  if (tx.status !== "PAID") {
    throw new AppError(
      tx.status === "RECEIPT_CONFIRMED" ? "Receipt already confirmed" : "Item has not been paid for yet",
      400
    );
  }

  const now = new Date();
  const auto_release_at = new Date(now.getTime() + env.AUTO_RELEASE_HOURS * 60 * 60 * 1000);

  await Transaction.findByIdAndUpdate(id, {
    status: "RECEIPT_CONFIRMED",
    receipt_confirmed_at: now,
    auto_release_at,
  });

  const seller = tx.seller_id as LeanUser;
  const listing = tx.listing_id as LeanListing;

  await EmailService.sendReceiptConfirmed(
    seller.email!,
    seller.first_name,
    listing.title,
    tx.seller_amount,
    auto_release_at
  );

  return sendSuccess({
    res,
    message: `Receipt confirmed. Payment will be released to the seller on ${auto_release_at.toISOString()} unless a dispute is raised.`,
    data: {
      transaction: {
        id,
        status: "RECEIPT_CONFIRMED",
        auto_release_at,
      },
    },
  });
});

export const releasePayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;

  const tx = await Transaction.findById(id)
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "title")
    .lean();

  if (!tx) throw new AppError("Transaction not found", 404);
  if (tx.buyer_id.toString() !== user_id) throw new AppError("Forbidden", 403);
  if (tx.status !== "RECEIPT_CONFIRMED") {
    throw new AppError("You can only release payment after confirming receipt", 400);
  }

  const now = new Date();
  await Transaction.findByIdAndUpdate(id, { status: "RELEASED", released_at: now });

  const seller = tx.seller_id as LeanUser;
  const listing = tx.listing_id as LeanListing;

  await EmailService.sendPaymentReleased(
    seller.email!,
    seller.first_name,
    listing.title,
    tx.seller_amount
  );

  return sendSuccess({
    res,
    message: "Payment released to seller successfully.",
    data: { transaction_id: id, status: "RELEASED", released_at: now },
  });
});

export const raiseDispute = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body as DisputeInput;
  const user_id = req.user!.id;

  const tx = await Transaction.findById(id)
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "title")
    .lean();

  if (!tx) throw new AppError("Transaction not found", 404);
  if (tx.buyer_id.toString() !== user_id) throw new AppError("Forbidden", 403);
  if (!["PAID", "RECEIPT_CONFIRMED"].includes(tx.status)) {
    throw new AppError("Disputes can only be raised on paid or receipt-confirmed transactions", 400);
  }

  await Transaction.findByIdAndUpdate(id, { status: "DISPUTED" });

  const seller = tx.seller_id as LeanUser;
  const listing = tx.listing_id as LeanListing;

  await EmailService.sendDisputeRaised(
    seller.email!,
    seller.first_name,
    listing.title,
    id
  );

  return sendSuccess({
    res,
    message: "Dispute raised. Our team will review and contact both parties. Payment is held until resolved.",
    data: { transaction_id: id, status: "DISPUTED", reason },
  });
});
