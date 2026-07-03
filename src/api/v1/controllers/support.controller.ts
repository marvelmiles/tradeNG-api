import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/response";
import { ContactMessage } from "@/models/v1/contact_message.model";
import { EmailService } from "@/api/v1/services/email.service";
import type { ContactSupportInput } from "@/api/v1/validators/support";

export const contactSupport = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body as ContactSupportInput;

  const contact_message = await ContactMessage.create({ name, email, subject, message });

  try {
    await EmailService.sendSupportNotification(name, email, subject, message);
    await EmailService.sendSupportContactReceipt(email, name);
    await ContactMessage.findByIdAndUpdate(contact_message._id, { emailed: true });
  } catch {
    // message is already persisted; delivery failure does not block the response
  }

  return sendSuccess({
    res,
    code: 201,
    message: "Your message has been received. We'll get back to you shortly.",
  });
});
