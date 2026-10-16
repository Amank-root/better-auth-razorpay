import { describe, expect, it } from "vitest";

import {
  createRazorpayPaymentSignature,
  createRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "../src/signature.js";

describe("Razorpay payment signature verification", () => {
  it("accepts a matching signature", () => {
    const signature = createRazorpayPaymentSignature(
      "order_123",
      "pay_123",
      "secret",
    );

    expect(
      verifyRazorpayPaymentSignature("order_123", "pay_123", signature, "secret"),
    ).toBe(true);
  });

  it("rejects a non-matching signature", () => {
    const signature = createRazorpayPaymentSignature(
      "order_123",
      "pay_123",
      "secret",
    );

    expect(
      verifyRazorpayPaymentSignature("order_123", "pay_456", signature, "secret"),
    ).toBe(false);
  });
});

describe("Razorpay webhook signature verification", () => {
  it("accepts a matching raw-body webhook signature", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const signature = createRazorpayWebhookSignature(body, "webhook_secret");

    expect(
      verifyRazorpayWebhookSignature(body, signature, "webhook_secret"),
    ).toBe(true);
  });

  it("rejects a signature generated for a different body", () => {
    const signature = createRazorpayWebhookSignature(
      JSON.stringify({ event: "payment.captured" }),
      "webhook_secret",
    );

    expect(
      verifyRazorpayWebhookSignature(
        JSON.stringify({ event: "payment.failed" }),
        signature,
        "webhook_secret",
      ),
    ).toBe(false);
  });
});
