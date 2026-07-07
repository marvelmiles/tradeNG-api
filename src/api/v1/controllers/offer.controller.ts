import { Request, Response } from "express";
import { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  parsePaginationQuery,
  buildPagePagination,
  buildCursorPagination,
  buildCursorFilter,
} from "@/utils/pagination";
import { Offer, IOffer } from "@/models/v1/offer.model";
import { Listing } from "@/models/v1/listing.model";
import { EmailService } from "@/api/v1/services/email.service";
import { createTransactionForSale } from "@/api/v1/services/transaction.service";
import { getOrCreateConversation, persistMessage } from "@/api/v1/services/message.service";
import { createNotification } from "@/api/v1/services/notification.service";
import { emitToConversation, emitToUser } from "@/lib/socket";
import type { CreateOfferInput, CounterOfferInput, DeclineOfferInput } from "@/api/v1/validators/offer";

const emitOfferUpdate = (offer: {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId;
  buyer_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  status: string;
  amount: number;
  parent_offer_id?: Types.ObjectId | null;
  transaction_id?: Types.ObjectId | null;
}): void => {
  const payload = {
    id: offer._id.toString(),
    listing_id: offer.listing_id.toString(),
    status: offer.status,
    amount: offer.amount,
    parent_offer_id: offer.parent_offer_id?.toString() ?? null,
    transaction_id: offer.transaction_id?.toString() ?? null,
  };
  emitToUser(offer.buyer_id.toString(), "offer:updated", payload);
  emitToUser(offer.seller_id.toString(), "offer:updated", payload);
};

const notifyOfferInChat = async (
  listing_id: string,
  buyer_id: string,
  seller_id: string,
  sender_id: string,
  body: string,
  offer_id: string
): Promise<void> => {
  const conversation = await getOrCreateConversation(listing_id, buyer_id, seller_id);
  const message = await persistMessage({
    conversation_id: conversation._id,
    sender_id,
    message_type: "OFFER",
    body,
    offer_id,
  });

  const offerWithTransaction = await Offer.findById(offer_id)
    .select("transaction_id")
    .populate<{ transaction_id: { _id: Types.ObjectId; status: string } | null }>("transaction_id", "status")
    .lean();
  const transaction = offerWithTransaction?.transaction_id;
  const transaction_status =
    transaction && !(transaction instanceof Types.ObjectId) ? transaction.status : undefined;

  emitToConversation(conversation._id.toString(), "message:new", {
    id: message._id.toString(),
    conversation_id: conversation._id.toString(),
    sender_id,
    message_type: message.message_type,
    body: message.body,
    offer_id,
    transaction_status,
    created_at: message.created_at,
  });
};

type LeanUser = { _id: Types.ObjectId; first_name: string; last_name: string; email?: string };
type LeanListing = { _id: Types.ObjectId; item_name: string; status: string; seller_id: Types.ObjectId | LeanUser; allow_price_negotiation: boolean; price: number };
type LeanOffer = Omit<IOffer, "listing_id" | "buyer_id" | "seller_id"> & {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId | LeanListing;
  buyer_id: Types.ObjectId | LeanUser;
  seller_id: Types.ObjectId | LeanUser;
};

const formatUser = (user: Types.ObjectId | LeanUser | null | undefined) => {
  if (!user || user instanceof Types.ObjectId) return null;
  return { id: user._id.toString(), first_name: user.first_name, last_name: user.last_name };
};

const inferProposerId = (offer: LeanOffer): string => {
  if (offer.proposed_by) return offer.proposed_by.toString();
  const buyer = offer.buyer_id as LeanUser;
  const seller = offer.seller_id as LeanUser;
  return offer.parent_offer_id ? seller._id.toString() : buyer._id.toString();
};

const resolveRespondingParties = (offer: LeanOffer, actor_id: string) => {
  const buyer = offer.buyer_id as LeanUser;
  const seller = offer.seller_id as LeanUser;
  const is_buyer = buyer._id.toString() === actor_id;
  const is_seller = seller._id.toString() === actor_id;
  if (!is_buyer && !is_seller) throw new AppError("Forbidden", 403);

  const proposer_id = inferProposerId(offer);
  const recipient_id = proposer_id === buyer._id.toString() ? seller._id.toString() : buyer._id.toString();
  if (actor_id !== recipient_id) {
    throw new AppError("It is not your turn to respond to this offer", 403);
  }

  return { buyer, seller, self: is_buyer ? buyer : seller, other: is_buyer ? seller : buyer };
};

const formatOffer = (offer: LeanOffer) => {
  const { _id, listing_id, buyer_id, seller_id, ...rest } = offer;

  const listing =
    listing_id && typeof listing_id === "object" && !(listing_id instanceof Types.ObjectId)
      ? {
          id: (listing_id as LeanListing)._id.toString(),
          item_name: (listing_id as LeanListing).item_name,
          status: (listing_id as LeanListing).status,
        }
      : null;

  return {
    id: _id.toString(),
    ...rest,
    parent_offer_id: rest.parent_offer_id?.toString() ?? null,
    proposed_by: rest.proposed_by?.toString() ?? null,
    transaction_id: rest.transaction_id?.toString(),
    ...(listing ? { listing } : {}),
    buyer: formatUser(buyer_id),
    seller: formatUser(seller_id),
  };
};

export const createOffer = asyncHandler(async (req: Request, res: Response) => {
  const { listingId } = req.params;
  const { amount, note } = req.body as CreateOfferInput;
  const buyer_id = req.user!.id;

  const listing = await Listing.findById(listingId)
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name last_name")
    .lean();

  if (!listing) throw new AppError("Listing not found", 404);
  if (listing.status !== "ACTIVE") throw new AppError("This listing is not available for offers", 400);
  if (!listing.allow_price_negotiation) throw new AppError("This seller does not accept offers on this listing", 400);
  if (listing.seller_id._id.toString() === buyer_id) throw new AppError("You cannot make an offer on your own listing", 400);

  const offer = await Offer.create({
    listing_id: listingId,
    buyer_id,
    seller_id: listing.seller_id._id,
    amount,
    note: note ?? null,
    proposed_by: buyer_id,
  });

  const populated = await Offer.findById(offer._id)
    .populate<{ buyer_id: LeanUser }>("buyer_id", "first_name last_name")
    .lean();

  await EmailService.sendOfferPlaced(
    listing.seller_id.email!,
    listing.seller_id.first_name,
    `${req.user!.first_name} ${req.user!.last_name}`,
    listing.item_name,
    amount
  );

  await notifyOfferInChat(
    listingId,
    buyer_id,
    listing.seller_id._id.toString(),
    buyer_id,
    `Offered ₦${amount.toLocaleString()}${note ? ` — ${note}` : ""}`,
    offer._id.toString()
  );

  emitOfferUpdate({
    _id: offer._id,
    listing_id: offer.listing_id,
    buyer_id: offer.buyer_id,
    seller_id: offer.seller_id,
    status: offer.status,
    amount: offer.amount,
  });

  await createNotification({
    user_id: listing.seller_id._id,
    type: "OFFER_RECEIVED",
    title: "New offer received",
    body: `${req.user!.first_name} offered ₦${amount.toLocaleString()} for "${listing.item_name}"`,
    related_listing_id: listingId,
  }).catch(() => undefined);

  return sendSuccess({
    res,
    code: 201,
    message: "Offer sent successfully",
    data: { offer: formatOffer(populated as unknown as LeanOffer) },
  });
});

export const getOffersReceived = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  const status = req.query.status as string | undefined;
  const where = { seller_id: req.user!.id, ...(status && { status }) };

  if (pagination.pagination_type === "cursor") {
    const items = await Offer.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate<{ buyer_id: LeanUser }>("buyer_id", "first_name last_name")
      .populate<{ listing_id: LeanListing }>("listing_id", "item_name status")
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { offers: items.slice(0, pagination.limit).map((o) => formatOffer(o as unknown as LeanOffer)) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Offer.find(where)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate<{ buyer_id: LeanUser }>("buyer_id", "first_name last_name")
      .populate<{ listing_id: LeanListing }>("listing_id", "item_name status")
      .lean(),
    Offer.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { offers: items.map((o) => formatOffer(o as unknown as LeanOffer)) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const getMyOfferThread = asyncHandler(async (req: Request, res: Response) => {
  const { listingId } = req.params;
  const buyer_id = req.user!.id;

  const offers = await Offer.find({ listing_id: listingId, buyer_id })
    .sort({ created_at: 1 })
    .populate<{ buyer_id: LeanUser }>("buyer_id", "first_name last_name")
    .populate<{ seller_id: LeanUser }>("seller_id", "first_name last_name")
    .lean();

  return sendSuccess({
    res,
    data: { offers: offers.map((o) => formatOffer(o as unknown as LeanOffer)) },
  });
});

export const acceptOffer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;

  const offer = await Offer.findById(id)
    .populate<{ buyer_id: LeanUser }>("buyer_id", "email first_name last_name")
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name last_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "item_name status seller_id price")
    .lean();

  if (!offer) throw new AppError("Offer not found", 404);
  const listing = offer.listing_id as unknown as LeanListing;
  if (offer.status !== "PENDING" && offer.status !== "COUNTERED") {
    throw new AppError("This offer is no longer available", 400);
  }
  const { buyer, seller, other } = resolveRespondingParties(offer as unknown as LeanOffer, user_id);

  const transaction = await createTransactionForSale(
    { _id: listing._id, status: listing.status, seller_id: seller._id, price: listing.price },
    buyer._id.toString(),
    offer.amount
  );

  await Offer.findByIdAndUpdate(id, {
    status: "ACCEPTED",
    responded_at: new Date(),
    transaction_id: transaction._id,
  });
  await Offer.updateMany(
    { listing_id: listing._id, _id: { $ne: offer._id }, status: { $in: ["PENDING", "COUNTERED"] } },
    { status: "DECLINED", responded_at: new Date() }
  );

  await EmailService.sendOfferAccepted(
    other.email!,
    other.first_name,
    listing.item_name,
    offer.amount,
    transaction._id.toString()
  );

  await notifyOfferInChat(
    listing._id.toString(),
    buyer._id.toString(),
    seller._id.toString(),
    user_id,
    `Accepted the offer of ₦${offer.amount.toLocaleString()}`,
    offer._id.toString()
  );

  emitOfferUpdate({
    _id: offer._id,
    listing_id: listing._id,
    buyer_id: buyer._id,
    seller_id: seller._id,
    status: "ACCEPTED",
    amount: offer.amount,
    parent_offer_id: offer.parent_offer_id,
    transaction_id: transaction._id,
  });

  await createNotification({
    user_id: other._id,
    type: "OFFER_ACCEPTED",
    title: "Offer accepted",
    body: `Your offer of ₦${offer.amount.toLocaleString()} on "${listing.item_name}" was accepted`,
    related_listing_id: listing._id,
    related_transaction_id: transaction._id,
  }).catch(() => undefined);

  return sendSuccess({
    res,
    code: 201,
    message: "Offer accepted. The buyer has been notified to complete payment.",
    data: {
      transaction: {
        id: transaction._id.toString(),
        amount: transaction.amount,
        platform_fee: transaction.platform_fee,
        seller_amount: transaction.seller_amount,
        status: transaction.status,
        created_at: transaction.created_at,
      },
    },
  });
});

export const counterOffer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, note } = req.body as CounterOfferInput;
  const user_id = req.user!.id;

  const offer = await Offer.findById(id)
    .populate<{ buyer_id: LeanUser }>("buyer_id", "email first_name last_name")
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name last_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "item_name status seller_id")
    .lean();

  if (!offer) throw new AppError("Offer not found", 404);
  const listing = offer.listing_id as unknown as LeanListing;
  if (offer.status !== "PENDING" && offer.status !== "COUNTERED") {
    throw new AppError("This offer is no longer available", 400);
  }
  const { buyer, seller, other } = resolveRespondingParties(offer as unknown as LeanOffer, user_id);

  await Offer.findByIdAndUpdate(id, { status: "COUNTERED", responded_at: new Date() });

  const counter = await Offer.create({
    listing_id: listing._id,
    buyer_id: buyer._id,
    seller_id: seller._id,
    amount,
    note: note ?? null,
    parent_offer_id: offer._id,
    proposed_by: user_id,
  });

  await EmailService.sendOfferCountered(other.email!, other.first_name, listing.item_name, amount);

  await notifyOfferInChat(
    listing._id.toString(),
    buyer._id.toString(),
    seller._id.toString(),
    user_id,
    `Countered with ₦${amount.toLocaleString()}${note ? ` — ${note}` : ""}`,
    counter._id.toString()
  );

  emitOfferUpdate({
    _id: offer._id,
    listing_id: listing._id,
    buyer_id: buyer._id,
    seller_id: seller._id,
    status: "COUNTERED",
    amount: offer.amount,
    parent_offer_id: offer.parent_offer_id,
  });
  emitOfferUpdate({
    _id: counter._id,
    listing_id: counter.listing_id,
    buyer_id: counter.buyer_id,
    seller_id: counter.seller_id,
    status: counter.status,
    amount: counter.amount,
    parent_offer_id: counter.parent_offer_id,
  });

  await createNotification({
    user_id: other._id,
    type: "OFFER_COUNTERED",
    title: `${user_id === buyer._id.toString() ? "Buyer" : "Seller"} countered your offer`,
    body: `${user_id === buyer._id.toString() ? "The buyer" : "The seller"} countered with ₦${amount.toLocaleString()} on "${listing.item_name}"`,
    related_listing_id: listing._id,
  }).catch(() => undefined);

  return sendSuccess({
    res,
    code: 201,
    message: "Counter offer sent",
    data: { offer: formatOffer((await Offer.findById(counter._id).lean()) as unknown as LeanOffer) },
  });
});

export const declineOffer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason: _reason } = req.body as DeclineOfferInput;
  const user_id = req.user!.id;

  const offer = await Offer.findById(id)
    .populate<{ buyer_id: LeanUser }>("buyer_id", "email first_name")
    .populate<{ seller_id: LeanUser }>("seller_id", "email first_name")
    .populate<{ listing_id: LeanListing }>("listing_id", "item_name seller_id")
    .lean();

  if (!offer) throw new AppError("Offer not found", 404);
  const listing = offer.listing_id as unknown as LeanListing;
  if (offer.status !== "PENDING" && offer.status !== "COUNTERED") {
    throw new AppError("This offer is no longer available", 400);
  }
  const { buyer, seller, other } = resolveRespondingParties(offer as unknown as LeanOffer, user_id);

  await Offer.findByIdAndUpdate(id, { status: "DECLINED", responded_at: new Date() });

  await EmailService.sendOfferDeclined(other.email!, other.first_name, listing.item_name);

  await notifyOfferInChat(
    listing._id.toString(),
    buyer._id.toString(),
    seller._id.toString(),
    user_id,
    "Declined the offer",
    offer._id.toString()
  );

  emitOfferUpdate({
    _id: offer._id,
    listing_id: listing._id,
    buyer_id: buyer._id,
    seller_id: seller._id,
    status: "DECLINED",
    amount: offer.amount,
    parent_offer_id: offer.parent_offer_id,
  });

  await createNotification({
    user_id: other._id,
    type: "OFFER_DECLINED",
    title: "Offer declined",
    body: `Your offer on "${listing.item_name}" was declined`,
    related_listing_id: listing._id,
  }).catch(() => undefined);

  return sendSuccess({ res, message: "Offer declined" });
});

export const withdrawOffer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;

  const offer = await Offer.findById(id).lean();
  if (!offer) throw new AppError("Offer not found", 404);
  if (offer.buyer_id.toString() !== user_id && offer.seller_id.toString() !== user_id) {
    throw new AppError("Forbidden", 403);
  }
  if (offer.status !== "PENDING" && offer.status !== "COUNTERED") {
    throw new AppError("Only pending offers can be withdrawn", 400);
  }
  const proposer_id = offer.proposed_by ? offer.proposed_by.toString() : offer.buyer_id.toString();
  if (proposer_id !== user_id) {
    throw new AppError("Only the party who made this offer can withdraw it", 403);
  }

  await Offer.findByIdAndUpdate(id, { status: "WITHDRAWN", responded_at: new Date() });

  const recipient_id = offer.buyer_id.toString() === user_id ? offer.seller_id.toString() : offer.buyer_id.toString();

  await notifyOfferInChat(
    offer.listing_id.toString(),
    offer.buyer_id.toString(),
    offer.seller_id.toString(),
    user_id,
    `Withdrew the offer of ₦${offer.amount.toLocaleString()}`,
    offer._id.toString()
  );

  emitOfferUpdate({
    _id: offer._id,
    listing_id: offer.listing_id,
    buyer_id: offer.buyer_id,
    seller_id: offer.seller_id,
    status: "WITHDRAWN",
    amount: offer.amount,
    parent_offer_id: offer.parent_offer_id,
  });

  await createNotification({
    user_id: recipient_id,
    type: "OFFER_WITHDRAWN",
    title: "Offer withdrawn",
    body: `The offer of ₦${offer.amount.toLocaleString()} was withdrawn`,
    related_listing_id: offer.listing_id,
  }).catch(() => undefined);

  return sendSuccess({ res, message: "Offer withdrawn successfully" });
});
