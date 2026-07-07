import axios from "axios";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/config/env";

const client = axios.create({
  baseURL: env.NOMBA_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    accountId: env.NOMBA_ACCOUNT_ID,
  },
});

let cached_token: string | null = null;
let cached_token_expires_at = 0;

interface NombaTokenResponse {
  data: { token?: string; expiresIn: number; access_token?: string };
}

const getAccessToken = async (): Promise<string> => {
  if (cached_token && Date.now() < cached_token_expires_at) return cached_token;

  const response = await client.post<NombaTokenResponse>(
    "/v1/auth/token/issue",
    {
      grant_type: "client_credentials",
      client_id: env.NOMBA_CLIENT_ID,
      client_secret: env.NOMBA_CLIENT_SECRET,
    },
  );

  const { token, access_token, expiresIn } = response.data.data;
  cached_token = access_token || token || "";
  cached_token_expires_at = Date.now() + Math.max(expiresIn - 60, 30) * 1000;

  return cached_token;
};

interface CreateCheckoutOrderParams {
  order_reference: string;
  amount: number;
  customer_email: string;
  callback_url?: string;
}

interface CreateCheckoutOrderResult {
  checkout_link: string;
  order_reference: string;
}

interface NombaCheckoutResponse {
  data: { checkoutLink: string };
}

export const createCheckoutOrder = async (
  params: CreateCheckoutOrderParams,
): Promise<CreateCheckoutOrderResult> => {
  const token = await getAccessToken();

  const response = await client.post<NombaCheckoutResponse>(
    "/v1/checkout/order",
    {
      order: {
        orderReference: params.order_reference,
        customerEmail: params.customer_email,
        amount: params.amount,
        currency: "NGN",
        callbackUrl: params.callback_url,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: env.NOMBA_ACCOUNT_ID,
      },
    },
  );

  return {
    checkout_link: response.data.data.checkoutLink,
    order_reference: params.order_reference,
  };
};

export interface NombaWebhookEvent {
  event_type: string;
  requestId: string;
  data: {
    merchant: { userId: string; walletId: string };
    transaction: {
      transactionId: string;
      type: string;
      time: string;
      responseCode?: string;
    };
    order?: { orderReference?: string; orderId?: string };
  };
}

export const verifyWebhookSignature = (
  payload: NombaWebhookEvent,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean => {
  if (!signature || !timestamp) return false;

  const { event_type, requestId } = payload;
  const { userId, walletId } = payload.data.merchant;
  const { transactionId, type, time, responseCode } = payload.data.transaction;

  const hashing_payload = [
    event_type,
    requestId,
    userId,
    walletId,
    transactionId,
    type,
    time,
    responseCode ?? "",
    timestamp,
  ].join(":");

  const expected = createHmac("sha256", env.NOMBA_WEBHOOK_SECRET)
    .update(hashing_payload)
    .digest("base64");

  const expected_buffer = Buffer.from(expected.toLowerCase(), "utf8");
  const provided_buffer = Buffer.from(signature.toLowerCase(), "utf8");

  if (expected_buffer.length !== provided_buffer.length) return false;

  return timingSafeEqual(expected_buffer, provided_buffer);
};

export interface VerifyTransactionResult {
  success: boolean;
  status: string;
  order_reference: string;
}

interface NombaFilterTransactionsResponse {
  data: {
    results: Array<{ status: string; orderReference?: string }>;
  };
}

interface NombaFetchCheckoutTransactionResponse {
  data: {
    success: boolean;
    message: string;
  };
}

const SUCCESS_STATUSES = ["SUCCESS", "PAYMENT_SUCCESSFUL"];

export const verifyTransaction = async (
  order_reference: string,
): Promise<VerifyTransactionResult> => {
  const token = await getAccessToken();

  if (env.NOMBA_CREDENTIALS_ENV === "production") {
    const response = await client.get<NombaFetchCheckoutTransactionResponse>(
      "/v1/checkout/transaction",
      {
        params: { idType: "ORDER_REFERENCE", id: order_reference },
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const { success, message } = response.data.data;

    return {
      success,
      status: success ? "SUCCESS" : (message || "PENDING").toUpperCase(),
      order_reference,
    };
  }

  const response = await client.post<NombaFilterTransactionsResponse>(
    "/v1/transactions/accounts",
    { orderReference: order_reference },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const match = response.data.data.results?.[0];

  return {
    success: !!match && SUCCESS_STATUSES.includes(match.status),
    status: match?.status ?? "NOT_FOUND",
    order_reference,
  };
};

export const extractOrderReference = (
  payload: NombaWebhookEvent,
): string | undefined =>
  payload.data.order?.orderReference ??
  (payload.data.transaction as { orderReference?: string }).orderReference ??
  (payload.data.transaction as { merchantTxRef?: string }).merchantTxRef;
