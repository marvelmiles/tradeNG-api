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
import { Conversation } from "@/models/v1/conversation.model";
import { Message } from "@/models/v1/message.model";
import { Listing } from "@/models/v1/listing.model";
import { getOrCreateConversation, persistMessage } from "@/api/v1/services/message.service";
import { createNotification } from "@/api/v1/services/notification.service";
import { emitToConversation } from "@/lib/socket";
import type { CreateConversationInput, SendMessageInput } from "@/api/v1/validators/conversation";

type LeanUser = { _id: Types.ObjectId; first_name: string; last_name: string };
type LeanListing = { _id: Types.ObjectId; item_name: string; images: string[] };

const formatConversation = (conversation: {
  _id: Types.ObjectId;
  listing_id: Types.ObjectId | LeanListing;
  buyer_id: Types.ObjectId | LeanUser;
  seller_id: Types.ObjectId | LeanUser;
  last_message_at: Date | null;
  last_message_preview: string | null;
}) => {
  const listing =
    conversation.listing_id && !(conversation.listing_id instanceof Types.ObjectId)
      ? {
          id: (conversation.listing_id as LeanListing)._id.toString(),
          item_name: (conversation.listing_id as LeanListing).item_name,
          images: (conversation.listing_id as LeanListing).images,
        }
      : null;

  const format_user = (user: Types.ObjectId | LeanUser) =>
    user instanceof Types.ObjectId ? null : { id: user._id.toString(), first_name: user.first_name, last_name: user.last_name };

  return {
    id: conversation._id.toString(),
    listing,
    buyer: format_user(conversation.buyer_id),
    seller: format_user(conversation.seller_id),
    last_message_at: conversation.last_message_at,
    last_message_preview: conversation.last_message_preview,
  };
};

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const { listing_id } = req.body as CreateConversationInput;
  const buyer_id = req.user!.id;

  const listing = await Listing.findById(listing_id).select("seller_id").lean();
  if (!listing) throw new AppError("Listing not found", 404);
  if (listing.seller_id.toString() === buyer_id) throw new AppError("You cannot message yourself", 400);

  const conversation = await getOrCreateConversation(listing_id, buyer_id, listing.seller_id.toString());

  const populated = await Conversation.findById(conversation._id)
    .populate("listing_id", "item_name images")
    .populate("buyer_id", "first_name last_name")
    .populate("seller_id", "first_name last_name")
    .lean();

  return sendSuccess({
    res,
    code: 201,
    message: "Conversation ready",
    data: { conversation: formatConversation(populated as never) },
  });
});

export const getMyConversations = asyncHandler(async (req: Request, res: Response) => {
  const user_id = req.user!.id;
  const pagination = parsePaginationQuery(req.query);
  const where = { $or: [{ buyer_id: user_id }, { seller_id: user_id }] };

  const populateOptions = [
    { path: "listing_id", select: "item_name images" },
    { path: "buyer_id", select: "first_name last_name" },
    { path: "seller_id", select: "first_name last_name" },
  ];

  if (pagination.pagination_type === "cursor") {
    const items = await Conversation.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .populate(populateOptions)
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { conversations: items.slice(0, pagination.limit).map((c) => formatConversation(c as never)) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Conversation.find(where)
      .sort({ last_message_at: -1, _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate(populateOptions)
      .lean(),
    Conversation.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { conversations: items.map((c) => formatConversation(c as never)) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

const assertParticipant = async (conversation_id: string, user_id: string) => {
  const conversation = await Conversation.findById(conversation_id).select("buyer_id seller_id").lean();
  if (!conversation) throw new AppError("Conversation not found", 404);
  if (conversation.buyer_id.toString() !== user_id && conversation.seller_id.toString() !== user_id) {
    throw new AppError("Forbidden", 403);
  }
  return conversation;
};

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;
  await assertParticipant(id, user_id);

  const pagination = parsePaginationQuery(req.query);
  const where = { conversation_id: id };

  if (pagination.pagination_type === "cursor") {
    const items = await Message.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ _id: -1 })
      .limit(pagination.limit + 1)
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: {
        messages: items.slice(0, pagination.limit).map((m) => ({
          id: m._id.toString(),
          sender_id: m.sender_id.toString(),
          message_type: m.message_type,
          body: m.body,
          offer_id: m.offer_id?.toString() ?? null,
          read_at: m.read_at,
          created_at: m.created_at,
        })),
      },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Message.find(where).sort({ _id: -1 }).skip(skip).limit(pagination.limit).lean(),
    Message.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: {
      messages: items.map((m) => ({
        id: m._id.toString(),
        sender_id: m.sender_id.toString(),
        message_type: m.message_type,
        body: m.body,
        offer_id: m.offer_id?.toString() ?? null,
        read_at: m.read_at,
        created_at: m.created_at,
      })),
    },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { body } = req.body as SendMessageInput;
  const user_id = req.user!.id;
  const conversation = await assertParticipant(id, user_id);

  const message = await persistMessage({ conversation_id: id, sender_id: user_id, body });

  emitToConversation(id, "message:new", {
    id: message._id.toString(),
    conversation_id: id,
    sender_id: user_id,
    message_type: message.message_type,
    body: message.body,
    created_at: message.created_at,
  });

  const recipient_id =
    conversation.buyer_id.toString() === user_id ? conversation.seller_id.toString() : conversation.buyer_id.toString();

  await createNotification({
    user_id: recipient_id,
    type: "NEW_MESSAGE",
    title: "New message",
    body: body.length > 100 ? `${body.slice(0, 100)}…` : body,
    related_conversation_id: id,
  }).catch(() => undefined);

  return sendSuccess({
    res,
    code: 201,
    message: "Message sent",
    data: {
      message: {
        id: message._id.toString(),
        sender_id: user_id,
        message_type: message.message_type,
        body: message.body,
        created_at: message.created_at,
      },
    },
  });
});

export const markConversationRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;
  await assertParticipant(id, user_id);

  await Message.updateMany(
    { conversation_id: id, sender_id: { $ne: user_id }, read_at: null },
    { read_at: new Date() }
  );

  return sendSuccess({ res, message: "Conversation marked as read" });
});
