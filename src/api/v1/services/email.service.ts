import { emailjs } from "@/lib/mailer";
import { env } from "@/config/env";

interface User {
  first_name: string;
  email: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const send = async (options: EmailOptions): Promise<void> => {
  try {
    await emailjs.send(env.EMAILJS_SERVICE_ID, env.EMAILJS_TEMPLATE_ID, {
      to_email: options.to,
      from_email: env.SMTP_FROM,
      subject: options.subject,
      body_html: options.html,
    });
  } catch (err) {
    const message =
      err && typeof err === "object" && "text" in err
        ? String((err as { text: unknown }).text)
        : "Failed to send email";
    throw new Error(message);
  }
};

const base = (title: string, body: string): string => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
      .wrapper { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      .header { background: #1a1a2e; padding: 28px 32px; }
      .header h1 { color: #fff; margin: 0; font-size: 22px; }
      .body { padding: 32px; color: #333; line-height: 1.6; }
      .otp { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e; text-align: center; padding: 20px; background: #f0f4ff; border-radius: 6px; margin: 24px 0; }
      .footer { padding: 20px 32px; background: #f9f9f9; color: #888; font-size: 12px; text-align: center; }
      .urgent { border-left: 4px solid #dc2626; padding-left: 16px; margin: 16px 0; }
      .warning { border-left: 4px solid #f59e0b; padding-left: 16px; margin: 16px 0; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="header"><h1>${env.APP_NAME}</h1></div>
      <div class="body">${body}</div>
      <div class="footer">© ${new Date().getFullYear()} ${env.APP_NAME}. You received this because you signed up.</div>
    </div>
  </body>
  </html>
`;

export const EmailService = {
  async sendOtp(user: User, otp: string) {
    await send({
      to: user.email,
      subject: `Your ${env.APP_NAME} verification code`,
      html: base(
        "Verify your account",
        `<p>Hi <strong>${user.first_name}</strong>,</p>
        <p>Welcome to ${env.APP_NAME}! Use the code below to verify your email address.</p>
        <div class="otp">${otp}</div>
        <p>This code expires in <strong>${env.OTP_EXPIRY_MINUTES} minutes</strong>. Do not share it with anyone.</p>
        <p>If you didn't sign up, you can safely ignore this email.</p>`,
      ),
    });
  },

  async sendVerificationReminder(user: User, type: string) {
    const templates: Record<string, { subject: string; body: string }> = {
      "1h": {
        subject: `Quick reminder — verify your ${env.APP_NAME} account`,
        body: `<p>Hey <strong>${user.first_name}</strong>,</p>
          <p>Just popping in! We noticed you haven't verified your email yet. No stress — it only takes a minute.</p>
          <p>Head back to the app, request a new OTP and you'll be all set to start buying and selling.</p>
          <p style="color:#666; font-size:14px;">Your account will be kept safe for the next 7 days.</p>`,
      },
      "5h": {
        subject: `Still here? Finish setting up your ${env.APP_NAME} account`,
        body: `<p>Hi <strong>${user.first_name}</strong>,</p>
          <p>You're this close to joining ${env.APP_NAME}! Your account is ready — we just need you to confirm your email.</p>
          <p>It takes literally 30 seconds. Open the app, hit "Resend OTP", and enter the code we send you.</p>
          <p style="color:#666; font-size:14px;">You have 6 days and 19 hours remaining before your unverified account is removed.</p>`,
      },
      "24h": {
        subject: `24 hours gone — your ${env.APP_NAME} account needs attention`,
        body: `<p>Hi <strong>${user.first_name}</strong>,</p>
          <p>It's been a day since you signed up on ${env.APP_NAME} and your account still isn't verified.</p>
          <div class="warning"><p><strong>Reminder:</strong> Unverified accounts are automatically removed after 7 days. You have <strong>6 days left</strong>.</p></div>`,
      },
      "3d": {
        subject: `[Action Required] Your ${env.APP_NAME} account expires in 4 days`,
        body: `<p>Hi <strong>${user.first_name}</strong>,</p>
          <p><strong>Please verify your email now to avoid losing your account.</strong></p>
          <div class="warning"><p>Your account will be <strong>permanently deleted in 4 days</strong> if email verification is not completed.</p></div>`,
      },
      "6d": {
        subject: `FINAL WARNING: Your ${env.APP_NAME} account deletes in less than 24 hours`,
        body: `<p>Hi <strong>${user.first_name}</strong>,</p>
          <div class="urgent"><p><strong>This is your last chance.</strong> Your ${env.APP_NAME} account will be <strong>permanently and irreversibly deleted in less than 24 hours</strong> because your email address was never verified.</p></div>
          <p>If you want to keep your account, you <strong>must verify your email right now</strong>.</p>`,
      },
    };

    const tmpl = templates[type];
    if (!tmpl) return;

    await send({
      to: user.email,
      subject: tmpl.subject,
      html: base(tmpl.subject, tmpl.body),
    });
  },

  async sendWelcome(user: User) {
    await send({
      to: user.email,
      subject: `Welcome to ${env.APP_NAME}!`,
      html: base(
        "Welcome!",
        `<p>Hi <strong>${user.first_name}</strong>,</p>
        <p>Your account is verified and you're all set! Welcome to ${env.APP_NAME} — the safest way to buy and sell.</p>
        <ul>
          <li><strong>Sell:</strong> List any item, new or used, and set your price.</li>
          <li><strong>Buy:</strong> Browse listings, make offers, or buy instantly.</li>
          <li><strong>Safe payments:</strong> We hold money securely until you confirm receipt.</li>
        </ul>`,
      ),
    });
  },

  async sendOfferPlaced(
    seller_email: string,
    seller_name: string,
    buyer_name: string,
    listing_title: string,
    amount: number,
  ) {
    await send({
      to: seller_email,
      subject: `New offer on your listing: ${listing_title}`,
      html: base(
        "New Offer Received",
        `<p>Hi <strong>${seller_name}</strong>,</p>
        <p><strong>${buyer_name}</strong> just offered <strong>₦${amount.toLocaleString()}</strong> for your listing "<strong>${listing_title}</strong>".</p>
        <p>Log in to accept, counter, or decline the offer.</p>`,
      ),
    });
  },

  async sendOfferAccepted(
    buyer_email: string,
    buyer_name: string,
    listing_title: string,
    amount: number,
    transaction_id: string,
  ) {
    await send({
      to: buyer_email,
      subject: `Your offer was accepted — complete payment for "${listing_title}"`,
      html: base(
        "Offer Accepted",
        `<p>Hi <strong>${buyer_name}</strong>,</p>
        <p>Your offer of <strong>₦${amount.toLocaleString()}</strong> on "<strong>${listing_title}</strong>" has been accepted.</p>
        <p>Please complete payment to secure your item.</p>
        <p><strong>Transaction ID:</strong> ${transaction_id}</p>`,
      ),
    });
  },

  async sendOfferCountered(
    buyer_email: string,
    buyer_name: string,
    listing_title: string,
    amount: number,
  ) {
    await send({
      to: buyer_email,
      subject: `Seller countered your offer on "${listing_title}"`,
      html: base(
        "Offer Countered",
        `<p>Hi <strong>${buyer_name}</strong>,</p>
        <p>The seller countered your offer with <strong>₦${amount.toLocaleString()}</strong> on "<strong>${listing_title}</strong>".</p>
        <p>Log in to accept, counter again, or decline.</p>`,
      ),
    });
  },

  async sendOfferDeclined(
    buyer_email: string,
    buyer_name: string,
    listing_title: string,
  ) {
    await send({
      to: buyer_email,
      subject: `Your offer on "${listing_title}" was declined`,
      html: base(
        "Offer Declined",
        `<p>Hi <strong>${buyer_name}</strong>,</p>
        <p>The seller declined your offer on "<strong>${listing_title}</strong>".</p>
        <p>Feel free to browse other listings or make a new offer.</p>`,
      ),
    });
  },

  async sendPaymentReceived(
    seller_email: string,
    seller_name: string,
    listing_title: string,
    seller_amount: number,
    transaction_id: string,
  ) {
    await send({
      to: seller_email,
      subject: `Payment received — ship your item "${listing_title}"`,
      html: base(
        "Payment Received",
        `<p>Hi <strong>${seller_name}</strong>,</p>
        <p>The buyer has paid for "<strong>${listing_title}</strong>". Funds (<strong>₦${seller_amount.toLocaleString()}</strong> after fees) are held in escrow.</p>
        <p>Please arrange shipping with the buyer. Once they confirm receipt, funds will be released to you.</p>
        <p><strong>Transaction ID:</strong> ${transaction_id}</p>`,
      ),
    });
  },

  async sendReceiptConfirmed(
    seller_email: string,
    seller_name: string,
    listing_title: string,
    seller_amount: number,
    auto_release_at: Date,
  ) {
    await send({
      to: seller_email,
      subject: `Buyer confirmed receipt — payment releasing soon for "${listing_title}"`,
      html: base(
        "Receipt Confirmed",
        `<p>Hi <strong>${seller_name}</strong>,</p>
        <p>The buyer has confirmed they received "<strong>${listing_title}</strong>".</p>
        <p>Your payment of <strong>₦${seller_amount.toLocaleString()}</strong> will be automatically released on <strong>${auto_release_at.toLocaleString()}</strong>.</p>`,
      ),
    });
  },

  async sendPaymentReleased(
    seller_email: string,
    seller_name: string,
    listing_title: string,
    seller_amount: number,
  ) {
    await send({
      to: seller_email,
      subject: `Payment released! ₦${seller_amount.toLocaleString()} for "${listing_title}"`,
      html: base(
        "Payment Released",
        `<p>Hi <strong>${seller_name}</strong>,</p>
        <p>Your payment of <strong>₦${seller_amount.toLocaleString()}</strong> for "<strong>${listing_title}</strong>" has been released.</p>
        <p>Thank you for selling on ${env.APP_NAME}!</p>`,
      ),
    });
  },

  async sendCategoryApproved(user_email: string, user_name: string, category_name: string) {
    await send({
      to: user_email,
      subject: `Your category request "${category_name}" was approved`,
      html: base(
        "Category Request Approved",
        `<p>Hi <strong>${user_name}</strong>,</p>
        <p>Good news! The category "<strong>${category_name}</strong>" you requested is now available. You can select it when listing an item.</p>`,
      ),
    });
  },

  async sendWithdrawalUpdate(user_email: string, user_name: string, amount: number, status: "COMPLETED" | "REJECTED") {
    const is_completed = status === "COMPLETED";
    await send({
      to: user_email,
      subject: is_completed
        ? `Withdrawal of ₦${amount.toLocaleString()} completed`
        : `Withdrawal of ₦${amount.toLocaleString()} was rejected`,
      html: base(
        "Withdrawal Update",
        `<p>Hi <strong>${user_name}</strong>,</p>
        <p>${
          is_completed
            ? `Your withdrawal of <strong>₦${amount.toLocaleString()}</strong> has been sent to your bank account.`
            : `Your withdrawal request of <strong>₦${amount.toLocaleString()}</strong> was rejected and the amount has been returned to your available balance.`
        }</p>`,
      ),
    });
  },

  async sendDisputeResolved(
    user_email: string,
    user_name: string,
    listing_title: string,
    resolution_note: string | null,
  ) {
    await send({
      to: user_email,
      subject: `Dispute resolved for "${listing_title}"`,
      html: base(
        "Dispute Resolved",
        `<p>Hi <strong>${user_name}</strong>,</p>
        <p>The dispute on "<strong>${listing_title}</strong>" has been resolved.</p>
        ${resolution_note ? `<p><strong>Resolution note:</strong> ${resolution_note}</p>` : ""}`,
      ),
    });
  },

  async sendVerifiedSellerApproved(user_email: string, user_name: string) {
    await send({
      to: user_email,
      subject: `You're now a verified seller on ${env.APP_NAME}!`,
      html: base(
        "Verified Seller",
        `<p>Hi <strong>${user_name}</strong>,</p>
        <p>Congratulations! Your seller verification request has been approved. Buyers will now see a verified badge on your listings.</p>`,
      ),
    });
  },

  async sendSupportNotification(name: string, email: string, subject: string, message: string) {
    await send({
      to: env.SUPPORT_INBOX_EMAIL,
      subject: `[Support] ${subject}`,
      html: base(
        "New Support Message",
        `<p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p>${message}</p>`,
      ),
    });
  },

  async sendSupportContactReceipt(user_email: string, user_name: string) {
    await send({
      to: user_email,
      subject: `We received your message`,
      html: base(
        "Message Received",
        `<p>Hi <strong>${user_name}</strong>,</p>
        <p>Thanks for reaching out to ${env.APP_NAME} support. We've received your message and will get back to you shortly.</p>`,
      ),
    });
  },

  async sendDisputeRaised(
    seller_email: string,
    seller_name: string,
    listing_title: string,
    transaction_id: string,
  ) {
    await send({
      to: seller_email,
      subject: `Dispute raised on your sale — "${listing_title}"`,
      html: base(
        "Dispute Raised",
        `<p>Hi <strong>${seller_name}</strong>,</p>
        <p>The buyer has raised a dispute on the transaction for "<strong>${listing_title}</strong>".</p>
        <p><strong>Transaction ID:</strong> ${transaction_id}</p>
        <p>Our team will review and get in touch with both parties. Payment is held until resolved.</p>`,
      ),
    });
  },
};
