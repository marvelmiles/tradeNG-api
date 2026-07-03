import { Types } from "mongoose";
import { Conversation } from "@/models/v1/conversation.model";
import { Message, MessageType } from "@/models/v1/message.model";

interface PersistMessageParams {
  conversation_id: string | Types.ObjectId;
  sender_id: string | Types.ObjectId;
  message_type?: MessageType;
  body?: string | null;
  offer_id?: string | Types.ObjectId | null;
}

export const isConversationParticipant = async (
  conversation_id: string,
  user_id: string
): Promise<boolean> => {
  const conversation = await Conversation.findById(conversation_id).select("buyer_id seller_id").lean();
  if (!conversation) return false;
  return conversation.buyer_id.toString() === user_id || conversation.seller_id.toString() === user_id;
};

export const persistMessage = async (params: PersistMessageParams) => {
  const message = await Message.create({
    conversation_id: params.conversation_id,
    sender_id: params.sender_id,
    message_type: params.message_type ?? "TEXT",
    body: params.body ?? null,
    offer_id: params.offer_id ?? null,
  });

  const preview = params.body
    ? params.body.slice(0, 200)
    : params.message_type === "OFFER"
    ? "Sent an offer"
    : "New activity";

  await Conversation.findByIdAndUpdate(params.conversation_id, {
    last_message_at: message.created_at,
    last_message_preview: preview,
  });

  return message;
};

export const getOrCreateConversation = async (listing_id: string, buyer_id: string, seller_id: string) => {
  const existing = await Conversation.findOne({ listing_id, buyer_id }).lean();
  if (existing) return existing;

  return Conversation.create({ listing_id, buyer_id, seller_id });
};
