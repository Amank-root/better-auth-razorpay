import { describe, expect, it } from "vitest";

import {
  serializeRazorpayOrder,
  serializeRazorpayPayment,
  serializeRazorpayRefund,
  toRazorpayOrderInput,
} from "../src/razorpay";

describe("toRazorpayOrderInput", () => {
  it("maps public camelCase input to Razorpay snake_case fields", () => {
    expect(
      toRazorpayOrderInput(
        {
          amount: 50000,
          receipt: "receipt_001",
          notes: { plan: "pro" },
          partialPayment: true,
          firstPaymentMinAmount: 10000,
        },
        "INR",
      ),
    ).toEqual({
      amount: 50000,
      currency: "INR",
      receipt: "receipt_001",
      notes: { plan: "pro" },
      partial_payment: true,
      first_payment_min_amount: 10000,
    });
  });

  it("uses explicit currency over default currency", () => {
    expect(
      toRazorpayOrderInput({ amount: 50000, currency: "USD" }, "INR"),
    ).toMatchObject({ currency: "USD" });
  });
});

describe("Razorpay serializers", () => {
  it("serializes order fields into public response shape", () => {
    expect(
      serializeRazorpayOrder({
        id: "order_123",
        entity: "order",
        amount: "50000",
        amount_paid: 0,
        amount_due: 50000,
        currency: "INR",
        status: "created",
        attempts: 0,
        created_at: 1700000000,
      }),
    ).toEqual({
      id: "order_123",
      entity: "order",
      amount: 50000,
      amountPaid: 0,
      amountDue: 50000,
      currency: "INR",
      receipt: null,
      status: "created",
      attempts: 0,
      notes: {},
      createdAt: 1700000000,
    });
  });

  it("serializes payment fields into public response shape", () => {
    expect(
      serializeRazorpayPayment({
        id: "pay_123",
        entity: "payment",
        amount: "50000",
        currency: "INR",
        status: "captured",
        method: "upi",
        captured: true,
        contact: 9999999999,
        created_at: 1700000000,
      }),
    ).toMatchObject({
      id: "pay_123",
      amount: 50000,
      orderId: null,
      contact: "9999999999",
      captured: true,
      notes: {},
    });
  });

  it("serializes refund fields into public response shape", () => {
    expect(
      serializeRazorpayRefund({
        id: "rfnd_123",
        entity: "refund",
        amount: 10000,
        currency: "INR",
        payment_id: "pay_123",
        status: "processed",
        created_at: 1700000000,
      }),
    ).toEqual({
      id: "rfnd_123",
      entity: "refund",
      amount: 10000,
      currency: "INR",
      paymentId: "pay_123",
      receipt: null,
      status: "processed",
      notes: {},
      createdAt: 1700000000,
      speedRequested: null,
      speedProcessed: null,
    });
  });
});
