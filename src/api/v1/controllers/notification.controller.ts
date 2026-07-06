import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import {
  parsePaginationQuery,
  buildPagePagination,
  buildCursorPagination,
  buildCursorFilter,
} from "@/utils/pagination";
import { Notification } from "@/models/v1/notification.model";
import { emitNotificationRead, emitAllNotificationsRead } from "@/api/v1/services/notification.service";

const formatNotification = (notification: {
  _id: { toString(): string };
  type: string;
  title: string;
  body: string;
  related_listing_id: { toString(): string } | null;
  related_transaction_id: { toString(): string } | null;
  related_conversation_id: { toString(): string } | null;
  read_at: Date | null;
  created_at: Date;
}) => ({
  id: notification._id.toString(),
  type: notification.type,
  title: notification.title,
  body: notification.body,
  related_listing_id: notification.related_listing_id?.toString() ?? null,
  related_transaction_id: notification.related_transaction_id?.toString() ?? null,
  related_conversation_id: notification.related_conversation_id?.toString() ?? null,
  read_at: notification.read_at,
  created_at: notification.created_at,
});

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user_id = req.user!.id;
  const pagination = parsePaginationQuery(req.query);
  const where = { user_id };

  if (pagination.pagination_type === "cursor") {
    const items = await Notification.find({ ...where, ...buildCursorFilter(pagination.cursor) })
      .sort({ read_at: 1, _id: -1 })
      .limit(pagination.limit + 1)
      .lean();

    const paginationResult = buildCursorPagination(pagination.cursor, items, pagination.limit);

    return sendSuccess({
      res,
      data: { notifications: items.slice(0, pagination.limit).map(formatNotification) },
      pagination: paginationResult,
    });
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const [items, total] = await Promise.all([
    Notification.find(where).sort({ read_at: 1, _id: -1 }).skip(skip).limit(pagination.limit).lean(),
    Notification.countDocuments(where),
  ]);

  return sendSuccess({
    res,
    data: { notifications: items.map(formatNotification) },
    pagination: buildPagePagination(pagination.page, pagination.limit, total),
  });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await Notification.countDocuments({ user_id: req.user!.id, read_at: null });
  return sendSuccess({ res, data: { unread_count: count } });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;

  const result = await Notification.updateOne({ _id: id, user_id, read_at: null }, { read_at: new Date() });
  if (result.modifiedCount > 0) {
    await emitNotificationRead(user_id, id);
  }

  return sendSuccess({ res, message: "Notification marked as read" });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const user_id = req.user!.id;

  const result = await Notification.updateMany({ user_id, read_at: null }, { read_at: new Date() });
  if (result.modifiedCount > 0) {
    emitAllNotificationsRead(user_id);
  }

  return sendSuccess({ res, message: "All notifications marked as read" });
});
