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
