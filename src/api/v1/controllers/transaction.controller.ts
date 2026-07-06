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
import { Dispute } from "@/models/v1/dispute.model";
import { EmailService } from "@/api/v1/services/email.service";
import { recordEscrowRelease } from "@/api/v1/services/wallet.service";
import { createNotification } from "@/api/v1/services/notification.service";
import {
  createCheckoutOrder,
  verifyTransaction as verifyNombaTransaction,
} from "@/lib/nomba";
import { markTransactionPaid } from "@/api/v1/services/transaction.service";
import type { DisputeInput } from "@/api/v1/validators/transaction";

// callbackUrl is optional, and Nomba appends `orderReference` as a query
// param on redirect — see
// https://developer.nomba.com/docs/products/accept-payment/create-checkout-order
// Their docs describe it as an HTTPS URL, but that's a production
// expectation, not a hard sandbox requirement; omitting it entirely (e.g. by
// rejecting a plain-HTTP FRONTEND_URL in local dev) just makes Nomba redirect
// the buyer to its own homepage instead of our payment-success page, so we
// always send it as long as it's a syntactically valid URL.
const buildCheckoutCallbackUrl = (
  transaction_id: string,
): string | undefined => {
  // const url = `${env.FRONTEND_URL}/payment-success/${transaction_id}`;
  const url = `${"https://trade-ng-kappa.vercel.app"}/callback`;

  try {
    console.log("building callback", url);
    new URL(url);
    return url;
  } catch {
    console.log("invalid urll");
    return undefined;
  }
};

type LeanUser = {
  _id: Types.ObjectId;
  first_name: string;
  last_name: string;
  email?: string;
};
type LeanListing = {
  _id: Types.ObjectId;
  item_name: string;
  condition: string;
};

type LeanTransaction = Omit<
  ITransaction,
  "listing_id" | "buyer_id" | "seller_id"
> & {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId | LeanListing;
  buyer_id: Types.ObjectId | LeanUser;
  seller_id: Types.ObjectId | LeanUser;
};

const formatTransaction = (tx: LeanTransaction) => {
  const { _id, listing_id, buyer_id, seller_id, ...rest } = tx;

  const listing =
    listing_id && !(listing_id instanceof Types.ObjectId)
      ? {
          id: (listing_id as LeanListing)._id.toString(),
          item_name: (listing_id as LeanListing).item_name,
          condition: (listing_id as LeanListing).condition,
        }
      : null;

  const buyer =
    buyer_id && !(buyer_id instanceof Types.ObjectId)
      ? {
          id: (buyer_id as LeanUser)._id.toString(),
          first_name: (buyer_id as LeanUser).first_name,
          last_name: (buyer_id as LeanUser).last_name,
        }
      : null;

  const seller =
    seller_id && !(seller_id instanceof Types.ObjectId)
      ? {
          id: (seller_id as LeanUser)._id.toString(),
          first_name: (seller_id as LeanUser).first_name,
          last_name: (seller_id as LeanUser).last_name,
        }
      : null;

  return {
    id: _id.toString(),
    ...rest,
    dispute_id: rest.dispute_id?.toString() ?? null,
    ...(listing ? { listing } : {}),
    ...(buyer ? { buyer } : {}),
    ...(seller ? { seller } : {}),
  };
};

export const getTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user_id = req.user!.id;

    const tx = await Transaction.findById(id)
      .populate<{
        listing_id: LeanListing;
      }>("listing_id", "item_name condition")
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
      data: {
        transaction: formatTransaction(tx as unknown as LeanTransaction),
      },
    });
  },
);

export const getMyTransactions = asyncHandler(
  async (req: Request, res: Response) => {
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
      { path: "listing_id", select: "item_name condition" },
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

      const paginationResult = buildCursorPagination(
        pagination.cursor,
        items,
        pagination.limit,
      );

      return sendSuccess({
        res,
        data: {
          transactions: items
            .slice(0, pagination.limit)
            .map((t: unknown) => formatTransaction(t as LeanTransaction)),
        },
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
      data: {
        transactions: transactions.map((t: unknown) =>
          formatTransaction(t as LeanTransaction),
        ),
      },
      pagination: buildPagePagination(pagination.page, pagination.limit, total),
    });
  },
);

export const checkoutTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user_id = req.user!.id;

    const tx = await Transaction.findById(id).lean();

    if (!tx) throw new AppError("Transaction not found", 404);
    if (tx.buyer_id.toString() !== user_id)
      throw new AppError("Forbidden", 403);
    if (tx.status !== "PENDING_PAYMENT") {
      throw new AppError(
        "Payment has already been initiated or completed",
        400,
      );
    }

    let checkout;
    try {
      checkout = await createCheckoutOrder({
        order_reference: tx._id.toString(),
        amount: tx.amount,
        customer_email: req.user!.email,
        callback_url: buildCheckoutCallbackUrl(tx._id.toString()),
      });
    } catch {
      throw new AppError("Payment provider unavailable, please try again", 502);
    }

    await Transaction.findByIdAndUpdate(id, {
      payment_ref: checkout.order_reference,
    });

    return sendSuccess({
      res,
      message:
        "Checkout session created. Complete payment via the checkout link.",
      data: { transaction_id: id, checkout_link: checkout.checkout_link },
    });
  },
);

export const verifyTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user_id = req.user!.id;

    const tx = await Transaction.findById(id).lean();

    if (!tx) throw new AppError("Transaction not found", 404);
    if (
      tx.buyer_id.toString() !== user_id &&
      tx.seller_id.toString() !== user_id
    ) {
      throw new AppError("Forbidden", 403);
    }
    if (!tx.payment_ref) {
      throw new AppError(
        "Checkout has not been initiated for this transaction",
        400,
      );
    }

    let status: string = tx.status;

    if (tx.status === "PENDING_PAYMENT") {
      let result;
      try {
        result = await verifyNombaTransaction(tx.payment_ref);
      } catch {
        throw new AppError(
          "Payment provider unavailable, please try again",
          502,
        );
      }

      if (result.success) {
        status = (await markTransactionPaid(tx._id)) ?? status;
      }
    }

    return sendSuccess({
      res,
      data: { transaction_id: id, status },
    });
  },
);

export const confirmReceipt = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user_id = req.user!.id;

    const tx = await Transaction.findById(id)
      .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
      .populate<{ listing_id: LeanListing }>("listing_id", "item_name")
      .lean();

    if (!tx) throw new AppError("Transaction not found", 404);
    if (tx.buyer_id.toString() !== user_id)
      throw new AppError("Forbidden", 403);
    if (tx.status !== "PAID") {
      throw new AppError(
        tx.status === "RECEIPT_CONFIRMED"
          ? "Receipt already confirmed"
          : "Item has not been paid for yet",
        400,
      );
    }

    const now = new Date();
    const auto_release_at = new Date(
      now.getTime() + env.AUTO_RELEASE_HOURS * 60 * 60 * 1000,
    );

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
      listing.item_name,
      tx.seller_amount,
      auto_release_at,
    );

    await createNotification({
      user_id: seller._id,
      type: "RECEIPT_CONFIRMED",
      title: "Buyer confirmed receipt",
      body: `The buyer confirmed receipt of "${listing.item_name}". Payment releases on ${auto_release_at.toLocaleDateString()}`,
      related_transaction_id: id,
    }).catch(() => undefined);

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
  },
);

export const releasePayment = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user_id = req.user!.id;

    const tx = await Transaction.findById(id)
      .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
      .populate<{ listing_id: LeanListing }>("listing_id", "item_name")
      .lean();

    if (!tx) throw new AppError("Transaction not found", 404);
    if (tx.buyer_id.toString() !== user_id)
      throw new AppError("Forbidden", 403);
    if (tx.status !== "RECEIPT_CONFIRMED") {
      throw new AppError(
        "You can only release payment after confirming receipt",
        400,
      );
    }

    const seller = tx.seller_id as LeanUser;
    const listing = tx.listing_id as LeanListing;

    const now = new Date();
    await Transaction.findByIdAndUpdate(id, {
      status: "RELEASED",
      released_at: now,
    });
    await recordEscrowRelease(seller._id, tx._id, tx.seller_amount);

    await EmailService.sendPaymentReleased(
      seller.email!,
      seller.first_name,
      listing.item_name,
      tx.seller_amount,
    );

    await createNotification({
      user_id: seller._id,
      type: "PAYMENT_RELEASED",
      title: "Payment released",
      body: `₦${tx.seller_amount.toLocaleString()} for "${listing.item_name}" has been released to you`,
      related_transaction_id: id,
    }).catch(() => undefined);

    return sendSuccess({
      res,
      message: "Payment released to seller successfully.",
      data: { transaction_id: id, status: "RELEASED", released_at: now },
    });
  },
);

export const raiseDispute = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason, evidence_urls } = req.body as DisputeInput;
    const user_id = req.user!.id;

    const tx = await Transaction.findById(id)
      .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
      .populate<{ listing_id: LeanListing }>("listing_id", "item_name")
      .lean();

    if (!tx) throw new AppError("Transaction not found", 404);
    if (tx.buyer_id.toString() !== user_id)
      throw new AppError("Forbidden", 403);
    if (!["PAID", "RECEIPT_CONFIRMED"].includes(tx.status)) {
      throw new AppError(
        "Disputes can only be raised on paid or receipt-confirmed transactions",
        400,
      );
    }

    const dispute = await Dispute.create({
      transaction_id: id,
      raised_by: user_id,
      description: reason,
      evidence_urls: evidence_urls ?? [],
    });

    await Transaction.findByIdAndUpdate(id, {
      status: "DISPUTED",
      dispute_id: dispute._id,
    });

    const seller = tx.seller_id as LeanUser;
    const listing = tx.listing_id as LeanListing;

    await EmailService.sendDisputeRaised(
      seller.email!,
      seller.first_name,
      listing.item_name,
      id,
    );

    await createNotification({
      user_id: seller._id,
      type: "DISPUTE_RAISED",
      title: "Dispute raised",
      body: `A dispute was raised on "${listing.item_name}". Payment is held until resolved.`,
      related_transaction_id: id,
    }).catch(() => undefined);

    return sendSuccess({
      res,
      code: 201,
      message:
        "Dispute raised. Our team will review and contact both parties. Payment is held until resolved.",
      data: {
        transaction_id: id,
        status: "DISPUTED",
        dispute_id: dispute._id.toString(),
      },
    });
  },
);

export const getDispute = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;

  const tx = await Transaction.findById(id)
    .select("buyer_id seller_id dispute_id")
    .lean();
  if (!tx) throw new AppError("Transaction not found", 404);
  if (
    tx.buyer_id.toString() !== user_id &&
    tx.seller_id.toString() !== user_id
  ) {
    throw new AppError("Forbidden", 403);
  }
  if (!tx.dispute_id)
    throw new AppError("No dispute exists for this transaction", 404);

  const dispute = await Dispute.findById(tx.dispute_id).lean();
  if (!dispute) throw new AppError("Dispute not found", 404);

  return sendSuccess({
    res,
    data: {
      dispute: {
        id: dispute._id.toString(),
        transaction_id: dispute.transaction_id.toString(),
        description: dispute.description,
        evidence_urls: dispute.evidence_urls,
        status: dispute.status,
        resolution_note: dispute.resolution_note,
        resolved_at: dispute.resolved_at,
        created_at: dispute.created_at,
      },
    },
  });
});
