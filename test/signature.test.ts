import { describe, expect, it } from "vitest";

import {
  createRazorpayPaymentSignature,
  createRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
  verifyRazorpayPaymentStatus,
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

describe("Razorpay payment status verification (server-side)", () => {
  const orderId = "order_123";
  const capturedPayment = {
    status: "captured" as const,
    amount: 5000,
    currency: "INR",
    order_id: orderId,
  };
  const failedPayment = {
    status: "failed" as const,
    amount: 5000,
    currency: "INR",
    order_id: orderId,
  };
  const authorizedPayment = {
    status: "authorized" as const,
    amount: 5000,
    currency: "INR",
    order_id: orderId,
  };
  const otherOrderPayment = {
    status: "captured" as const,
    amount: 5000,
    currency: "INR",
    order_id: "order_999",
  };
  const wrongAmountPayment = {
    status: "captured" as const,
    amount: 9999,
    currency: "INR",
    order_id: orderId,
  };

  it("accepts a captured payment with matching order", () => {
    const result = verifyRazorpayPaymentStatus(capturedPayment, orderId);
    expect(result.valid).toBe(true);
    expect(result.paymentStatus).toBe("captured");
    expect(result.amount).toBe(5000);
    expect(result.currency).toBe("INR");
    expect(result.orderId).toBe(orderId);
    expect(result.reason).toBeUndefined();
  });

  it("rejects a failed payment", () => {
    const result = verifyRazorpayPaymentStatus(failedPayment, orderId);
    expect(result.valid).toBe(false);
    expect(result.paymentStatus).toBe("failed");
    expect(result.reason).toBe("payment_not_captured");
  });

  it("rejects an authorized (not yet captured) payment", () => {
    const result = verifyRazorpayPaymentStatus(authorizedPayment, orderId);
    expect(result.valid).toBe(false);
    expect(result.paymentStatus).toBe("authorized");
    expect(result.reason).toBe("payment_not_captured");
  });

  it("rejects a payment belonging to a different order", () => {
    const result = verifyRazorpayPaymentStatus(otherOrderPayment, orderId);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("order_mismatch");
    expect(result.orderId).toBe("order_999");
  });

  it("rejects a payment with an amount different from expected", () => {
    const result = verifyRazorpayPaymentStatus(
      wrongAmountPayment,
      orderId,
      5000,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("amount_mismatch");
    expect(result.amount).toBe(9999);
  });

  it("accepts a captured payment when expectedAmount matches", () => {
    const result = verifyRazorpayPaymentStatus(
      capturedPayment,
      orderId,
      5000,
    );
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("handles numeric string amounts", () => {
    const stringAmountPayment = {
      status: "captured" as const,
      amount: "5000",
      currency: "INR",
      order_id: orderId,
    };
    const result = verifyRazorpayPaymentStatus(
      stringAmountPayment,
      orderId,
      5000,
    );
    expect(result.valid).toBe(true);
    expect(result.amount).toBe(5000);
  });

  it("handles null order_id on the payment", () => {
    const result = verifyRazorpayPaymentStatus(
      { status: "captured", amount: 5000, currency: "INR", order_id: null },
      orderId,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("order_mismatch");
    expect(result.orderId).toBeNull();
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
