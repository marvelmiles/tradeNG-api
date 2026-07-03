import { config } from "dotenv";
config();

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

const optional = (key: string, defaultVal: string): string => {
  return process.env[key] ?? defaultVal;
};

export const env = {
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: parseInt(optional("PORT", "3000")),
  APP_NAME: optional("APP_NAME", "TradeNG"),
  APP_URL: optional("APP_URL", "http://localhost:3000"),
  API_VERSION: optional("API_VERSION", "v1"),
  MONGODB_URI: required("MONGODB_URI"),
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRY: optional("JWT_EXPIRY", "7d"),
  EMAILJS_SERVICE_ID: required("EMAILJS_SERVICE_ID"),
  EMAILJS_TEMPLATE_ID: required("EMAILJS_TEMPLATE_ID"),
  EMAILJS_PUBLIC_KEY: required("EMAILJS_PUBLIC_KEY"),
  EMAILJS_PRIVATE_KEY: required("EMAILJS_PRIVATE_KEY"),
  SMTP_FROM: optional("SMTP_FROM", "noreply@tradeng.com"),
  PLATFORM_FEE_PERCENT: parseFloat(optional("PLATFORM_FEE_PERCENT", "5")),
  OTP_EXPIRY_MINUTES: parseInt(optional("OTP_EXPIRY_MINUTES", "15")),
  ACCOUNT_EXPIRY_DAYS: parseInt(optional("ACCOUNT_EXPIRY_DAYS", "7")),
  AUTO_RELEASE_HOURS: parseInt(optional("AUTO_RELEASE_HOURS", "48")),

  CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: required("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: required("CLOUDINARY_API_SECRET"),

  NOMBA_CLIENT_ID: required("NOMBA_CLIENT_ID"),
  NOMBA_CLIENT_SECRET: required("NOMBA_CLIENT_SECRET"),
  NOMBA_ACCOUNT_ID: required("NOMBA_ACCOUNT_ID"),
  NOMBA_BASE_URL: optional("NOMBA_BASE_URL", "https://api.nomba.com"),
  NOMBA_WEBHOOK_SECRET: required("NOMBA_WEBHOOK_SECRET"),

  SUPPORT_INBOX_EMAIL: optional("SUPPORT_INBOX_EMAIL", "support@tradeng.com"),
  SOCKET_CORS_ORIGIN: optional("SOCKET_CORS_ORIGIN", "*"),
  WITHDRAWAL_MIN_AMOUNT: parseFloat(optional("WITHDRAWAL_MIN_AMOUNT", "1000")),
} as const;
