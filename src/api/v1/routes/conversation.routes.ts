import { Router } from "express";
import { requireAuth } from "@/api/v1/middleware/auth";
import { validate } from "@/api/v1/middleware/validate";
import {
  createConversation,
  getMyConversations,
  getMessages,
  sendMessage,
  markConversationRead,
} from "@/api/v1/controllers/conversation.controller";
import { createConversationSchema, sendMessageSchema } from "@/api/v1/validators/conversation";

const router = Router();

router.get("/", requireAuth, getMyConversations);
router.post("/", requireAuth, validate(createConversationSchema), createConversation);

router.get("/:id/messages", requireAuth, getMessages);
router.post("/:id/messages", requireAuth, validate(sendMessageSchema), sendMessage);
router.patch("/:id/read", requireAuth, markConversationRead);

export default router;
