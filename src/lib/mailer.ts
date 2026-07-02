import nodemailer from "nodemailer";
import { env } from "@/config/env";

export const transporter = nodemailer.createTransport({
  // host: env.SMTP_HOST,
  // port: env.SMTP_PORT,
  // secure: env.SMTP_PORT === 465,

  service: "gmail",
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});
