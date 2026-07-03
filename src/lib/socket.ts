import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { User } from "@/models/v1/user.model";
import { Conversation } from "@/models/v1/conversation.model";
import { isConversationParticipant, persistMessage } from "@/api/v1/services/message.service";
import { createNotification } from "@/api/v1/services/notification.service";

interface JwtPayload {
  user_id: string;
}

let io: Server | null = null;

const conversationRoom = (conversation_id: string) => `conversation:${conversation_id}`;
const userRoom = (user_id: string) => `user:${user_id}`;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: { origin: env.SOCKET_CORS_ORIGIN, credentials: true },
  });

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Authentication token required"));
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      next(new Error("Invalid or expired token"));
      return;
    }

    const user = await User.findById(payload.user_id).select("status").lean();
    if (!user || user.status !== "ACTIVE") {
      next(new Error("Account not authorized"));
      return;
    }

    socket.data.user_id = payload.user_id;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const user_id = socket.data.user_id as string;
    socket.join(userRoom(user_id));

    socket.on("conversation:join", async ({ conversation_id }: { conversation_id: string }) => {
      const allowed = await isConversationParticipant(conversation_id, user_id);
      if (!allowed) {
        socket.emit("error", { message: "Not a participant in this conversation" });
        return;
      }
      socket.join(conversationRoom(conversation_id));
    });

    socket.on("message:send", async ({ conversation_id, body }: { conversation_id: string; body: string }) => {
      const allowed = await isConversationParticipant(conversation_id, user_id);
      if (!allowed) {
        socket.emit("error", { message: "Not a participant in this conversation" });
        return;
      }
      if (!body || !body.trim()) return;

      const message = await persistMessage({ conversation_id, sender_id: user_id, body: body.trim() });
      emitToConversation(conversation_id, "message:new", {
        id: message._id.toString(),
        conversation_id,
        sender_id: user_id,
        message_type: message.message_type,
        body: message.body,
        created_at: message.created_at,
      });

      const conversation = await Conversation.findById(conversation_id).select("buyer_id seller_id").lean();
      if (conversation) {
        const recipient_id =
          conversation.buyer_id.toString() === user_id
            ? conversation.seller_id.toString()
            : conversation.buyer_id.toString();

        await createNotification({
          user_id: recipient_id,
          type: "NEW_MESSAGE",
          title: "New message",
          body: body.length > 100 ? `${body.slice(0, 100)}…` : body,
          related_conversation_id: conversation_id,
        }).catch(() => undefined);
      }
    });

    socket.on("typing:start", ({ conversation_id }: { conversation_id: string }) => {
      socket.to(conversationRoom(conversation_id)).emit("typing:start", { conversation_id, user_id });
    });

    socket.on("typing:stop", ({ conversation_id }: { conversation_id: string }) => {
      socket.to(conversationRoom(conversation_id)).emit("typing:stop", { conversation_id, user_id });
    });
  });

  return io;
};

export const emitToConversation = (conversation_id: string, event: string, payload: unknown): void => {
  io?.to(conversationRoom(conversation_id)).emit(event, payload);
};

export const emitToUser = (user_id: string, event: string, payload: unknown): void => {
  io?.to(userRoom(user_id)).emit(event, payload);
};
