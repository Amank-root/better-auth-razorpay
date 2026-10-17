import { describe, expect, it, vi } from "vitest";
import {
  serializeRazorpayPaymentList,
  serializeRazorpayPaymentListForOrder,
  serializeRazorpayOrderList,
  serializeRazorpayRefund,
  serializeRazorpayRefundList,
  serializeRazorpayRefundSingle,
} from "../src/razorpay";
import {
  onPaymentAuthorized,
  onPaymentCaptured,
  onPaymentFailed,
  onOrderPaid,
  onRefundCreated,
  onRefundProcessed,
  onRefundFailed,
  onInvoicePaid,
  onInvoicePartiallyPaid,
  onInvoiceExpired,
} from "../src/hooks";
import type {
  RazorpayOptions,
  RazorpayWebhookEvent,
  RazorpayPaymentEntity,
  RazorpayRefundEntity,
  RazorpayOrderEntity,
  RazorpayInvoiceEntity,
} from "../src/types";

// ─── Mock Factories ──────────────────────────────────────────────────────────

function makeMockAdapter() {
  return {
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function makeMockCtx(adapter = makeMockAdapter()) {
  return {
    context: {
      adapter,
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
    },
  } as any;
}

function makePaymentEntity(
  overrides: Partial<RazorpayPaymentEntity> = {},
): RazorpayPaymentEntity {
  return {
    id: "pay_123",
    entity: "payment",
    amount: 50000,
    currency: "INR",
    status: "captured",
    method: "upi",
    captured: true,
    created_at: 1700000000,
    ...overrides,
  };
}

function makeRefundEntity(
  overrides: Partial<RazorpayRefundEntity> = {},
): RazorpayRefundEntity {
  return {
    id: "rfnd_123",
    entity: "refund",
    amount: 10000,
    currency: "INR",
    payment_id: "pay_123",
    status: "processed",
    created_at: 1700000000,
    ...overrides,
  };
}

function makeOrderEntity(
  overrides: Partial<RazorpayOrderEntity> = {},
): RazorpayOrderEntity {
  return {
    id: "order_123",
    entity: "order",
    amount: 50000,
    amount_paid: 50000,
    amount_due: 0,
    currency: "INR",
    status: "paid",
    attempts: 1,
    created_at: 1700000000,
    ...overrides,
  };
}

function makeInvoiceEntity(
  overrides: Partial<RazorpayInvoiceEntity> = {},
): RazorpayInvoiceEntity {
  return {
    id: "inv_123",
    entity: "invoice",
    invoice_number: "inv_001",
    status: "paid",
    amount: 50000,
    amount_paid: 50000,
    amount_due: 0,
    currency: "INR",
    created_at: 1700000000,
    ...overrides,
  } as RazorpayInvoiceEntity;
}

function makePaymentWebhook(
  payload: Record<string, unknown> = {},
): RazorpayWebhookEvent {
  return {
    entity: "event",
    account_id: "acc_001",
    event: "payment.captured",
    contains: ["payment"],
    payload,
    created_at: Date.now() / 1000,
  } as RazorpayWebhookEvent;
}

function makeRefundWebhook(
  eventName: string,
  payload: Record<string, unknown> = {},
): RazorpayWebhookEvent {
  return {
    entity: "event",
    account_id: "acc_001",
    event: eventName,
    contains: ["refund"],
    payload,
    created_at: Date.now() / 1000,
  } as RazorpayWebhookEvent;
}

function makeOrderWebhook(
  payload: Record<string, unknown> = {},
): RazorpayWebhookEvent {
  return {
    entity: "event",
    account_id: "acc_001",
    event: "order.paid",
    contains: ["order"],
    payload,
    created_at: Date.now() / 1000,
  } as RazorpayWebhookEvent;
}

function makeInvoiceWebhook(
  eventName: string,
  payload: Record<string, unknown> = {},
): RazorpayWebhookEvent {
  return {
    entity: "event",
    account_id: "acc_001",
    event: eventName,
    contains: ["invoice"],
    payload,
    created_at: Date.now() / 1000,
  } as RazorpayWebhookEvent;
}

function makeOptions(
  overrides: Partial<RazorpayOptions> = {},
): RazorpayOptions {
  return {
    razorpayClient: {} as any,
    razorpayWebhookSecret: "secret",
    subscription: {
      enabled: true,
      plans: [{ planId: "plan_001", name: "Basic" }],
    },
    ...overrides,
  } as RazorpayOptions;
}

// ─── Payment Webhook Handler Tests ───────────────────────────────────────────

describe("onPaymentAuthorized", () => {
  it("calls onPaymentAuthorized callback with payment entity", async () => {
    const ctx = makeMockCtx();
    const payment = makePaymentEntity({ status: "authorized", captured: false });
    const event = makePaymentWebhook({
      payment: { entity: payment },
    });
    const callback = vi.fn();
    const options = makeOptions({
      onPaymentAuthorized: callback,
    });

    await onPaymentAuthorized(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({ id: "pay_123" }),
      }),
    );
  });

  it("does nothing if no payment entity in payload", async () => {
    const ctx = makeMockCtx();
    const event = makePaymentWebhook({});
    const callback = vi.fn();
    const options = makeOptions({ onPaymentAuthorized: callback });

    await onPaymentAuthorized(ctx, options, event);

    expect(callback).not.toHaveBeenCalled();
  });

  it("catches and logs errors without throwing", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn().mockRejectedValue(new Error("Callback failed"));
    const options = makeOptions({ onPaymentAuthorized: callback });
    const event = makePaymentWebhook({
      payment: { entity: makePaymentEntity() },
    });

    await expect(
      onPaymentAuthorized(ctx, options, event),
    ).resolves.toBeUndefined();

    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("payment.authorized"),
    );
  });
});

describe("onPaymentCaptured", () => {
  it("calls onPaymentCaptured callback with captured payment", async () => {
    const ctx = makeMockCtx();
    const payment = makePaymentEntity({ status: "captured", captured: true });
    const event = makePaymentWebhook({
      payment: { entity: payment },
    });
    const callback = vi.fn();
    const options = makeOptions({ onPaymentCaptured: callback });

    await onPaymentCaptured(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({ id: "pay_123", captured: true }),
      }),
    );
  });

  it("does nothing if no payment entity in payload", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn();
    const options = makeOptions({ onPaymentCaptured: callback });

    await onPaymentCaptured(ctx, options, makePaymentWebhook({}));

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("onPaymentFailed", () => {
  it("calls onPaymentFailed callback with failed payment", async () => {
    const ctx = makeMockCtx();
    const payment = makePaymentEntity({
      status: "failed",
      captured: false,
      error_code: "BAD_REQUEST",
      error_description: "Invalid card",
    });
    const event = makePaymentWebhook({
      payment: { entity: payment },
    });
    const callback = vi.fn();
    const options = makeOptions({ onPaymentFailed: callback });

    await onPaymentFailed(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({
          id: "pay_123",
          status: "failed",
          error_code: "BAD_REQUEST",
          error_description: "Invalid card",
        }),
      }),
    );
  });

  it("does nothing if no payment entity in payload", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn();
    const options = makeOptions({ onPaymentFailed: callback });

    await onPaymentFailed(ctx, options, makePaymentWebhook({}));

    expect(callback).not.toHaveBeenCalled();
  });
});

// ─── Order Webhook Handler Tests ─────────────────────────────────────────────

describe("onOrderPaid", () => {
  it("calls onOrderPaid callback with order entity", async () => {
    const ctx = makeMockCtx();
    const order = makeOrderEntity({ status: "paid" });
    const event = makeOrderWebhook({
      order: { entity: order },
    });
    const callback = vi.fn();
    const options = makeOptions({ onOrderPaid: callback });

    await onOrderPaid(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ id: "order_123", status: "paid" }),
      }),
    );
  });

  it("does nothing if no order entity in payload", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn();
    const options = makeOptions({ onOrderPaid: callback });

    await onOrderPaid(ctx, options, makeOrderWebhook({}));

    expect(callback).not.toHaveBeenCalled();
  });

  it("catches and logs errors without throwing", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn().mockRejectedValue(new Error("Callback failed"));
    const options = makeOptions({ onOrderPaid: callback });
    const event = makeOrderWebhook({
      order: { entity: makeOrderEntity() },
    });

    await expect(
      onOrderPaid(ctx, options, event),
    ).resolves.toBeUndefined();
    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("order.paid"),
    );
  });
});

// ─── Refund Webhook Handler Tests ────────────────────────────────────────────

describe("onRefundCreated", () => {
  it("calls onRefundCreated callback with refund entity", async () => {
    const ctx = makeMockCtx();
    const refund = makeRefundEntity({ status: "created" });
    const event = makeRefundWebhook("refund.created", {
      refund: { entity: refund },
    });
    const callback = vi.fn();
    const options = makeOptions({ onRefundCreated: callback });

    await onRefundCreated(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        refund: expect.objectContaining({ id: "rfnd_123", status: "created" }),
      }),
    );
  });

  it("does nothing if no refund entity in payload", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn();
    const options = makeOptions({ onRefundCreated: callback });

    await onRefundCreated(
      ctx,
      options,
      makeRefundWebhook("refund.created", {}),
    );

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("onRefundProcessed", () => {
  it("calls onRefundProcessed callback with processed refund", async () => {
    const ctx = makeMockCtx();
    const refund = makeRefundEntity({
      status: "processed",
      speed_processed: "optimum",
    });
    const event = makeRefundWebhook("refund.processed", {
      refund: { entity: refund },
    });
    const callback = vi.fn();
    const options = makeOptions({ onRefundProcessed: callback });

    await onRefundProcessed(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        refund: expect.objectContaining({
          id: "rfnd_123",
          status: "processed",
          speed_processed: "optimum",
        }),
      }),
    );
  });

  it("does nothing if no refund entity in payload", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn();
    const options = makeOptions({ onRefundProcessed: callback });

    await onRefundProcessed(
      ctx,
      options,
      makeRefundWebhook("refund.processed", {}),
    );

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("onRefundFailed", () => {
  it("calls onRefundFailed callback with failed refund", async () => {
    const ctx = makeMockCtx();
    const refund = makeRefundEntity({ status: "failed" });
    const event = makeRefundWebhook("refund.failed", {
      refund: { entity: refund },
    });
    const callback = vi.fn();
    const options = makeOptions({ onRefundFailed: callback });

    await onRefundFailed(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        refund: expect.objectContaining({ id: "rfnd_123", status: "failed" }),
      }),
    );
  });

  it("logs error and does not throw on callback failure", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn().mockRejectedValue(new Error("Callback failed"));
    const options = makeOptions({ onRefundFailed: callback });
    const event = makeRefundWebhook("refund.failed", {
      refund: { entity: makeRefundEntity() },
    });

    await expect(
      onRefundFailed(ctx, options, event),
    ).resolves.toBeUndefined();
    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("refund.failed"),
    );
  });
});

// ─── Invoice Webhook Handler Tests ───────────────────────────────────────────

describe("onInvoicePaid", () => {
  it("calls onInvoicePaid callback with invoice entity", async () => {
    const ctx = makeMockCtx();
    const invoice = makeInvoiceEntity({ status: "paid" });
    const event = makeInvoiceWebhook("invoice.paid", {
      invoice: { entity: invoice },
    });
    const callback = vi.fn();
    const options = makeOptions({ onInvoicePaid: callback });

    await onInvoicePaid(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice: expect.objectContaining({ id: "inv_123", status: "paid" }),
      }),
    );
  });

  it("does nothing if no invoice entity in payload", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn();
    const options = makeOptions({ onInvoicePaid: callback });

    await onInvoicePaid(
      ctx,
      options,
      makeInvoiceWebhook("invoice.paid", {}),
    );

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("onInvoicePartiallyPaid", () => {
  it("calls onInvoicePartiallyPaid callback with partially paid invoice", async () => {
    const ctx = makeMockCtx();
    const invoice = makeInvoiceEntity({
      status: "partially_paid",
      amount: 50000,
      amount_paid: 25000,
      amount_due: 25000,
    });
    const event = makeInvoiceWebhook("invoice.partially_paid", {
      invoice: { entity: invoice },
    });
    const callback = vi.fn();
    const options = makeOptions({ onInvoicePartiallyPaid: callback });

    await onInvoicePartiallyPaid(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice: expect.objectContaining({
          id: "inv_123",
          status: "partially_paid",
          amount_paid: 25000,
        }),
      }),
    );
  });

  it("does nothing if no invoice entity in payload", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn();
    const options = makeOptions({ onInvoicePartiallyPaid: callback });

    await onInvoicePartiallyPaid(
      ctx,
      options,
      makeInvoiceWebhook("invoice.partially_paid", {}),
    );

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("onInvoiceExpired", () => {
  it("calls onInvoiceExpired callback with expired invoice", async () => {
    const ctx = makeMockCtx();
    const invoice = makeInvoiceEntity({ status: "expired" });
    const event = makeInvoiceWebhook("invoice.expired", {
      invoice: { entity: invoice },
    });
    const callback = vi.fn();
    const options = makeOptions({ onInvoiceExpired: callback });

    await onInvoiceExpired(ctx, options, event);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice: expect.objectContaining({ id: "inv_123", status: "expired" }),
      }),
    );
  });

  it("catches and logs errors without throwing", async () => {
    const ctx = makeMockCtx();
    const callback = vi.fn().mockRejectedValue(new Error("Callback failed"));
    const options = makeOptions({ onInvoiceExpired: callback });
    const event = makeInvoiceWebhook("invoice.expired", {
      invoice: { entity: makeInvoiceEntity() },
    });

    await expect(
      onInvoiceExpired(ctx, options, event),
    ).resolves.toBeUndefined();
    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("invoice.expired"),
    );
  });
});

// ─── Serializer Tests ────────────────────────────────────────────────────────

describe("List serializers", () => {
  it("serializes payment list into response shape", () => {
    const list = {
      entity: "list",
      count: 2,
      items: [
        makePaymentEntity({ id: "pay_001", amount: "50000" }),
        makePaymentEntity({ id: "pay_002", amount: "25000" }),
      ],
    };

    const result = serializeRazorpayPaymentList(list);

    expect(result.entity).toBe("list");
    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.id).toBe("pay_001");
    expect(result.items[0]!.amount).toBe(50000);
    expect(result.items[1]!.id).toBe("pay_002");
    expect(result.items[1]!.amount).toBe(25000);
  });

  it("serializes refund list into response shape", () => {
    const list = {
      entity: "list",
      count: 2,
      items: [
        makeRefundEntity({ id: "rfnd_001", amount: 10000 }),
        makeRefundEntity({ id: "rfnd_002", amount: 5000 }),
      ],
    };

    const result = serializeRazorpayRefundList(list);

    expect(result.entity).toBe("list");
    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.id).toBe("rfnd_001");
    expect(result.items[0]!.paymentId).toBe("pay_123");
    expect(result.items[1]!.id).toBe("rfnd_002");
    expect(result.items[1]!.amount).toBe(5000);
  });

  it("serializes order list into response shape", () => {
    const list = {
      entity: "list",
      count: 1,
      items: [
        makeOrderEntity({ id: "order_001", amount: 50000 }),
      ],
    };

    const result = serializeRazorpayOrderList(list);

    expect(result.entity).toBe("list");
    expect(result.count).toBe(1);
    expect(result.items[0]!.id).toBe("order_001");
    expect(result.items[0]!.amount).toBe(50000);
  });

  it("serializes payment list for order into response shape", () => {
    const list = {
      entity: "list",
      count: 1,
      items: [makePaymentEntity({ id: "pay_001" })],
    };

    const result = serializeRazorpayPaymentListForOrder(list);

    expect(result.count).toBe(1);
    expect(result.items[0]!.id).toBe("pay_001");
  });

  it("serializeRazorpayRefundSingle delegates to serializeRazorpayRefund", () => {
    const refund = makeRefundEntity({ id: "rfnd_123" });

    const single = serializeRazorpayRefundSingle(refund);
    const direct = serializeRazorpayRefund(refund);

    expect(single).toEqual(direct);
    expect(single.id).toBe("rfnd_123");
    expect(single!.paymentId).toBe("pay_123");
  });

  it("handles empty items array in list serializers", () => {
    const emptyList = {
      entity: "list",
      count: 0,
      items: [] as any[],
    };

    expect(serializeRazorpayPaymentList(emptyList).items).toEqual([]);
    expect(serializeRazorpayRefundList(emptyList).items).toEqual([]);
    expect(serializeRazorpayOrderList(emptyList).items).toEqual([]);
  });
});
