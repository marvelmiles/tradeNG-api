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
  callback_url: string;
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

export const verifyWebhookSignature = (
  raw_body: Buffer,
  signature: string | undefined,
): boolean => {
  if (!signature) return false;

  const expected = createHmac("sha256", env.NOMBA_WEBHOOK_SECRET)
    .update(raw_body)
    .digest("hex");

  const expected_buffer = Buffer.from(expected, "utf8");
  const provided_buffer = Buffer.from(signature, "utf8");

  if (expected_buffer.length !== provided_buffer.length) return false;

  return timingSafeEqual(expected_buffer, provided_buffer);
};

export interface NombaWebhookPayload {
  order_reference: string;
  status: string;
}

export const extractNombaPayload = (raw: unknown): NombaWebhookPayload => {
  const body = raw as Record<string, any>;
  const data = body?.data ?? body;

  return {
    order_reference: data?.orderReference ?? data?.order_reference ?? "",
    status: (data?.status ?? data?.orderStatus ?? "").toString().toUpperCase(),
  };
};
