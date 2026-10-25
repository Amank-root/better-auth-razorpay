import { describe, expect, it } from "vitest";

import {
  serializeRazorpayOrder,
  serializeRazorpayPayment,
  serializeRazorpayRefund,
  serializeRazorpayTransfer,
  serializeRazorpayReversal,
  serializeRazorpayTransferList,
  toRazorpayOrderInput,
  toRazorpayTransferInput,
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
          paymentCapture: false,
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
      payment_capture: false,
    });
  });

  it("omits payment_capture when paymentCapture is not provided", () => {
    const result = toRazorpayOrderInput({ amount: 50000 }, "INR");
    expect(result).not.toHaveProperty("payment_capture");
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

describe("toRazorpayTransferInput", () => {
  it("maps camelCase transfer item to Razorpay snake_case fields", () => {
    const result = toRazorpayTransferInput({
      account: "acc_123",
      amount: 10000,
      currency: "INR",
      notes: { order_id: "ORD_123" },
      onHold: true,
      onHoldUntil: 1893456000,
      linkedAccountNotes: ["order_id"],
    });

    expect(result).toEqual({
      account: "acc_123",
      amount: 10000,
      currency: "INR",
      notes: { order_id: "ORD_123" },
      on_hold: true,
      on_hold_until: 1893456000,
      linked_account_notes: ["order_id"],
    });
  });

  it("omits optional fields when not provided", () => {
    const result = toRazorpayTransferInput({
      account: "acc_123",
      amount: 10000,
      currency: "INR",
    });

    expect(result).toEqual({
      account: "acc_123",
      amount: 10000,
      currency: "INR",
    });
    expect(result).not.toHaveProperty("notes");
    expect(result).not.toHaveProperty("on_hold");
    expect(result).not.toHaveProperty("linked_account_notes");
  });
});

describe("serializeRazorpayTransfer", () => {
  it("serializes transfer fields into public response shape", () => {
    const transfer = {
      id: "trf_123",
      entity: "transfer",
      amount: "10000",
      currency: "INR",
      status: "processed",
      settlement_status: "settled",
      source: "pay_123",
      recipient: "acc_123",
      amount_reversed: 0,
      fees: 500,
      tax: 90,
      recipient_settlement_id: "set_123",
      recipient_settlement: null,
      created_at: 1700000000,
      processed_at: 1700000100,
      notes: { ref: "abc" },
      error: null,
    };

    expect(serializeRazorpayTransfer(transfer as any)).toEqual({
      id: "trf_123",
      entity: "transfer",
      amount: 10000,
      currency: "INR",
      status: "processed",
      settlementStatus: "settled",
      source: "pay_123",
      recipient: "acc_123",
      amountReversed: 0,
      fee: 500,
      tax: 90,
      recipientSettlementId: "set_123",
      createdAt: 1700000000,
      processedAt: 1700000100,
      notes: { ref: "abc" },
      error: null,
    });
  });

  it("handles numeric amounts and null settlement fields", () => {
    const transfer = {
      id: "trf_456",
      entity: "transfer",
      amount: 5000,
      currency: "INR",
      status: "created",
      source: "pay_456",
      recipient: "acc_456",
      amount_reversed: 0,
      fees: 0,
      tax: null,
      recipient_settlement_id: null,
      recipient_settlement: null,
      created_at: 1700000000,
      processed_at: 1700000000,
      notes: {},
      error: null,
    };

    expect(serializeRazorpayTransfer(transfer as any)).toMatchObject({
      amount: 5000,
      tax: null,
      recipientSettlementId: null,
      notes: {},
    });
  });
});

describe("serializeRazorpayReversal", () => {
  it("serializes reversal fields into public response shape", () => {
    const reversal = {
      id: "rvrs_123",
      entity: "reversal",
      transfer_id: "trf_123",
      amount: 5000,
      fee: 25,
      tax: 4,
      currency: "INR",
      notes: {},
      initiator_id: "cust_123",
      customer_refund_id: null,
      created_at: 1700000000,
    };

    expect(serializeRazorpayReversal(reversal as any)).toEqual({
      id: "rvrs_123",
      entity: "reversal",
      transferId: "trf_123",
      amount: 5000,
      fee: 25,
      tax: 4,
      currency: "INR",
      notes: {},
      initiatorId: "cust_123",
      customerRefundId: null,
      createdAt: 1700000000,
    });
  });
});

describe("serializeRazorpayTransferList", () => {
  it("serializes a list of transfers", () => {
    const list = {
      entity: "list",
      count: 2,
      items: [
        {
          id: "trf_1",
          entity: "transfer",
          amount: "1000",
          currency: "INR",
          status: "processed",
          source: "pay_1",
          recipient: "acc_1",
          amount_reversed: 0,
          fees: 50,
          tax: 9,
          recipient_settlement_id: null,
          recipient_settlement: null,
          created_at: 1700000000,
          processed_at: 1700000100,
          notes: {},
          error: null,
        },
        {
          id: "trf_2",
          entity: "transfer",
          amount: 2000,
          currency: "INR",
          status: "created",
          source: "pay_2",
          recipient: "acc_2",
          amount_reversed: 0,
          fees: 0,
          tax: null,
          recipient_settlement_id: null,
          recipient_settlement: null,
          created_at: 1700000001,
          processed_at: 1700000001,
          notes: {},
          error: null,
        },
      ],
    };

    const result = serializeRazorpayTransferList(list as any);
    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.id).toBe("trf_1");
    expect(result.items[0]?.amount).toBe(1000);
    expect(result.items[1]?.id).toBe("trf_2");
    expect(result.items[1]?.amount).toBe(2000);
  });
});
