import { Types } from "mongoose";
import { Notification, NotificationType } from "@/models/v1/notification.model";
import { User } from "@/models/v1/user.model";
import { emitToUser } from "@/lib/socket";

interface CreateNotificationParams {
  user_id: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  related_listing_id?: string | Types.ObjectId | null;
  related_transaction_id?: string | Types.ObjectId | null;
  related_conversation_id?: string | Types.ObjectId | null;
}

const OFFER_TYPES = new Set<NotificationType>(["OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_COUNTERED", "OFFER_DECLINED"]);

export const getUnreadCount = (user_id: string | Types.ObjectId): Promise<number> =>
  Notification.countDocuments({ user_id, read_at: null });

export const createNotification = async (params: CreateNotificationParams) => {
  const notification = await Notification.create({
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    body: params.body,
    related_listing_id: params.related_listing_id ?? null,
    related_transaction_id: params.related_transaction_id ?? null,
    related_conversation_id: params.related_conversation_id ?? null,
  });

  const user = await User.findById(params.user_id).select("notification_settings").lean();
  const settings = user?.notification_settings;
  const in_app_enabled = OFFER_TYPES.has(params.type) ? settings?.in_app_offers : settings?.in_app_general;

  if (in_app_enabled !== false) {
    const unread_count = await getUnreadCount(params.user_id);

    emitToUser(params.user_id.toString(), "notification:new", {
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      related_listing_id: notification.related_listing_id?.toString() ?? null,
      related_transaction_id: notification.related_transaction_id?.toString() ?? null,
      related_conversation_id: notification.related_conversation_id?.toString() ?? null,
      created_at: notification.created_at,
      unread_count,
    });
  }

  return notification;
};

export const emitNotificationRead = async (
  user_id: string | Types.ObjectId,
  notification_id: string,
): Promise<void> => {
  const unread_count = await getUnreadCount(user_id);
  emitToUser(user_id.toString(), "notification:read", { id: notification_id, unread_count });
};

export const emitAllNotificationsRead = (user_id: string | Types.ObjectId): void => {
  emitToUser(user_id.toString(), "notification:read-all", { unread_count: 0 });
};

export const shouldSendEmail = async (user_id: string | Types.ObjectId, type: NotificationType): Promise<boolean> => {
  const user = await User.findById(user_id).select("notification_settings").lean();
  if (!user) return true;
  return OFFER_TYPES.has(type) ? user.notification_settings.email_offers : user.notification_settings.email_general;
};
