import { createHmac, timingSafeEqual } from "node:crypto";

export const createRazorpayPaymentSignature = (
  orderId: string,
  paymentId: string,
  keySecret: string,
) =>
  createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

export const verifyRazorpayPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
) => {
  const expectedSignature = createRazorpayPaymentSignature(
    orderId,
    paymentId,
    keySecret,
  );

  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(signature, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
};

/**
 * Result of verifying a fetched Razorpay payment's status, amount, and order
 * association — to be used in addition to signature verification.
 */
export interface RazorpayPaymentVerificationStatus {
  /**
   * `true` only when the signature is valid AND the payment is captured, the
   * order_id matches, and (if `expectedAmount` was provided) the amount matches.
   */
  valid: boolean;
  /** The raw status string returned by Razorpay (e.g. "captured", "failed"). */
  paymentStatus: string;
  /** The payment amount in currency subunits (e.g. paise). */
  amount: number;
  /** The currency code (e.g. "INR"). */
  currency: string;
  /** The order_id associated with the payment, if any. */
  orderId: string | null;
  /** Machine-readable reason when `valid` is false. */
  reason?:
    | "invalid_signature"
    | "order_mismatch"
    | "amount_mismatch"
    | "payment_not_captured"
    | undefined;
}

/**
 * Validate a *fetched* payment entity against the expected order id and
 * (optionally) the expected amount.
 *
 * This is the server-side counterpart to {@link verifyRazorpayPaymentSignature}
 * — it guards against a valid signature being submitted for a failed payment,
 * a different amount, or an unrelated order.
 *
 * The caller is still responsible for verifying the cryptographic signature
 * first (via {@link verifyRazorpayPaymentSignature}). This function only
 * inspects the fields on the payment entity that Razorpay returns.
 *
 * @param payment       The Razorpay payment entity (from `client.payments.fetch`).
 * @param expectedOrderId The order id submitted by the client.
 * @param expectedAmount  Optional expected amount (in subunits) to validate.
 */
export const verifyRazorpayPaymentStatus = (
  payment: {
    status: string;
    amount: number | string;
    currency: string;
    order_id?: string | null;
  },
  expectedOrderId: string,
  expectedAmount?: number,
): RazorpayPaymentVerificationStatus => {
  const amount = Number(payment.amount);

  // 1. Order association — the payment must belong to the order the client claims.
  if (payment.order_id !== expectedOrderId) {
    return {
      valid: false,
      paymentStatus: payment.status,
      amount,
      currency: payment.currency,
      orderId: payment.order_id ?? null,
      reason: "order_mismatch",
    };
  }

  // 2. Amount — if the caller provided an expected amount, enforce it.
  if (expectedAmount !== undefined && amount !== expectedAmount) {
    return {
      valid: false,
      paymentStatus: payment.status,
      amount,
      currency: payment.currency,
      orderId: payment.order_id ?? null,
      reason: "amount_mismatch",
    };
  }

  // 3. Status — for one-time checkout payments the payment must be captured.
  const isCaptured = payment.status === "captured";

  return {
    valid: isCaptured,
    paymentStatus: payment.status,
    amount,
    currency: payment.currency,
    orderId: payment.order_id ?? null,
    reason: isCaptured ? undefined : "payment_not_captured",
  };
};

export const createRazorpayWebhookSignature = (
  rawBody: string,
  webhookSecret: string,
) => createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

export const verifyRazorpayWebhookSignature = (
  rawBody: string,
  signature: string,
  webhookSecret: string,
) => {
  const expectedSignature = createRazorpayWebhookSignature(
    rawBody,
    webhookSecret,
  );

  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(signature, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
};
