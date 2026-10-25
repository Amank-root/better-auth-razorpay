import Razorpay from "razorpay";

import type {
  CreateRazorpayOrderInput,
  CreateRazorpayTransferItem,
  RazorpayOrderResponse,
  RazorpayOrderListResponse,
  RazorpayPaymentResponse,
  RazorpayPaymentListResponse,
  RazorpayPaymentListForOrderResponse,
  RazorpayPluginOptions,
  RazorpayRefundResponse,
  RazorpayRefundListResponse,
  RazorpayReversalResponse,
  RazorpayTransferResponse,
} from "./types.js";

type RazorpayOrderCreateRequestBody = {
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string | number | null>;
  partial_payment?: boolean;
  first_payment_min_amount?: number;
  payment_capture?: boolean;
};

type RazorpayOrder = {
  id: string;
  entity: string;
  amount: number | string;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string | null;
  status: string;
  attempts: number;
  notes?: Record<string, string | number | null>;
  created_at: number;
};

type RazorpayPayment = {
  id: string;
  entity: string;
  amount: number | string;
  currency: string;
  status: string;
  order_id?: string | null;
  invoice_id?: string | null;
  method: string;
  captured: boolean;
  amount_refunded?: number;
  refund_status?: string | null;
  email?: string | null;
  contact?: string | number | null;
  notes?: Record<string, string | number | null>;
  error_code?: string | null;
  error_description?: string | null;
  created_at: number;
};

type RazorpayRefund = {
  id: string;
  entity: string;
  amount?: number | null;
  currency: string;
  payment_id: string;
  receipt?: string | null;
  status: string;
  notes?: Record<string, string | number | null>;
  created_at: number;
  speed_requested?: string | null;
  speed_processed?: string | null;
};

type RazorpayTransfer = {
  id: string;
  entity: string;
  amount: number | string;
  currency: string;
  status: string;
  settlement_status?: string | null;
  source: string;
  recipient: string;
  amount_reversed: number;
  fees: number;
  tax: number | null;
  recipient_settlement_id: string | null;
  recipient_settlement: string | null;
  created_at: number;
  processed_at: number;
  notes?: Record<string, string | number | null>;
  error: {
    code: string | null;
    description: string | null;
    reason: string | null;
    field: string | null;
    step: string | null;
    id: string | null;
    source: string | null;
    metadata: string | null;
  } | null;
};

type RazorpayReversal = {
  id: string;
  entity: string;
  transfer_id: string;
  amount: number;
  fee: number | null;
  tax: number | null;
  currency: string;
  notes: Record<string, unknown>;
  initiator_id: string | null;
  customer_refund_id: string | null;
  created_at: number;
};

type RazorpayTransferCreateItem = {
  account: string;
  amount: number;
  currency: string;
  notes?: Record<string, string | number | null>;
  on_hold?: boolean | 0 | 1;
  on_hold_until?: number;
  linked_account_notes?: string[];
};

type RazorpayClient = {
  orders: {
    create(input: RazorpayOrderCreateRequestBody): Promise<RazorpayOrder>;
    fetch(orderId: string): Promise<RazorpayOrder>;
  };
  payments: {
    fetch(paymentId: string): Promise<RazorpayPayment>;
    capture(
      paymentId: string,
      amount: number,
      currency: string,
    ): Promise<RazorpayPayment>;
    refund(
      paymentId: string,
      input: {
        amount?: number;
        speed?: "normal" | "optimum";
        receipt?: string;
        notes?: Record<string, string | number | null>;
      },
    ): Promise<RazorpayRefund>;
    /** Create transfers (split payments) from a payment. */
    transfer(
      paymentId: string,
      params: { transfers: RazorpayTransferCreateItem[] },
    ): Promise<{ items: RazorpayTransfer[] }>;
    /** Fetch all transfers made against a payment. */
    fetchTransfer(paymentId: string): Promise<{ items: RazorpayTransfer[] }>;
  };
  transfers: {
    create(params: RazorpayTransferCreateItem): Promise<RazorpayTransfer>;
    fetch(transferId: string): Promise<RazorpayTransfer>;
    all(params?: Record<string, unknown>): Promise<{
      entity: string;
      count: number;
      items: RazorpayTransfer[];
    }>;
    edit(
      transferId: string,
      params: { on_hold?: boolean | 0 | 1; on_hold_until?: number },
    ): Promise<RazorpayTransfer>;
    reverse(transferId: string, params?: { amount: number }): Promise<RazorpayReversal>;
  };
};

export const createRazorpayClient = (options: RazorpayPluginOptions) =>
  new Razorpay({
    key_id: options.keyId!,
    key_secret: options.keySecret!,
  }) as unknown as RazorpayClient;

export const toRazorpayOrderInput = (
  input: CreateRazorpayOrderInput,
  defaultCurrency: string,
): RazorpayOrderCreateRequestBody => {
  const order: RazorpayOrderCreateRequestBody = {
    amount: input.amount,
    currency: input.currency ?? defaultCurrency,
  };

  if (input.receipt !== undefined) {
    order.receipt = input.receipt;
  }

  if (input.notes !== undefined) {
    order.notes = input.notes;
  }

  if (input.partialPayment !== undefined) {
    order.partial_payment = input.partialPayment;
  }

  if (input.firstPaymentMinAmount !== undefined) {
    order.first_payment_min_amount = input.firstPaymentMinAmount;
  }

  if (input.paymentCapture !== undefined) {
    order.payment_capture = input.paymentCapture;
  }

  return order;
};

export const serializeRazorpayOrder = (
  order: RazorpayOrder,
): RazorpayOrderResponse => ({
  id: order.id,
  entity: order.entity,
  amount: Number(order.amount),
  amountPaid: order.amount_paid,
  amountDue: order.amount_due,
  currency: order.currency,
  receipt: order.receipt ?? null,
  status: order.status,
  attempts: order.attempts,
  notes: order.notes ?? {},
  createdAt: order.created_at,
});

export const serializeRazorpayPayment = (
  payment: RazorpayPayment,
): RazorpayPaymentResponse => ({
  id: payment.id,
  entity: payment.entity,
  amount: Number(payment.amount),
  currency: payment.currency,
  status: payment.status,
  orderId: payment.order_id ?? null,
  invoiceId: payment.invoice_id ?? null,
  method: payment.method,
  captured: payment.captured,
  amountRefunded: payment.amount_refunded ?? 0,
  refundStatus: payment.refund_status ?? null,
  email: payment.email ?? null,
  contact:
    payment.contact === undefined || payment.contact === null
      ? null
      : String(payment.contact),
  notes: payment.notes ?? {},
  errorCode: payment.error_code ?? null,
  errorDescription: payment.error_description ?? null,
  createdAt: payment.created_at,
});

export const serializeRazorpayRefund = (
  refund: RazorpayRefund,
): RazorpayRefundResponse => ({
  id: refund.id,
  entity: refund.entity,
  amount: refund.amount ?? null,
  currency: refund.currency,
  paymentId: refund.payment_id,
  receipt: refund.receipt ?? null,
  status: refund.status,
  notes: refund.notes ?? {},
  createdAt: refund.created_at,
  speedRequested: refund.speed_requested ?? null,
  speedProcessed: refund.speed_processed ?? null,
});

// ─── List Serializers ────────────────────────────────────────────────────────

export const serializeRazorpayPaymentList = (list: {
  entity: string;
  count: number;
  items: RazorpayPayment[];
}): RazorpayPaymentListResponse => ({
  entity: list.entity,
  count: list.count,
  items: list.items.map(serializeRazorpayPayment),
});

export const serializeRazorpayRefundList = (list: {
  entity: string;
  count: number;
  items: RazorpayRefund[];
}): RazorpayRefundListResponse => ({
  entity: list.entity,
  count: list.count,
  items: list.items.map((r) => ({
    id: r.id,
    entity: r.entity,
    amount: r.amount ?? null,
    currency: r.currency,
    paymentId: r.payment_id,
    receipt: r.receipt ?? null,
    status: r.status,
    notes: r.notes ?? {},
    createdAt: r.created_at,
    speedRequested: r.speed_requested ?? null,
    speedProcessed: r.speed_processed ?? null,
  })),
});

export const serializeRazorpayOrderList = (list: {
  entity: string;
  count: number;
  items: RazorpayOrder[];
}): RazorpayOrderListResponse => ({
  entity: list.entity,
  count: list.count,
  items: list.items.map(serializeRazorpayOrder),
});

export const serializeRazorpayPaymentListForOrder = (list: {
  entity: string;
  count: number;
  items: RazorpayPayment[];
}): RazorpayPaymentListForOrderResponse => ({
  entity: list.entity,
  count: list.count,
  items: list.items.map(serializeRazorpayPayment),
});

export const serializeRazorpayRefundSingle = (refund: RazorpayRefund): RazorpayRefundResponse =>
  serializeRazorpayRefund(refund);

// ─── Transfer serializers ───────────────────────────────────────────────────

export const toRazorpayTransferInput = (
  input: CreateRazorpayTransferItem,
): RazorpayTransferCreateItem => {
  const item: RazorpayTransferCreateItem = {
    account: input.account,
    amount: input.amount,
    currency: input.currency,
  };

  if (input.notes !== undefined) {
    item.notes = input.notes;
  }

  if (input.onHold !== undefined) {
    item.on_hold = input.onHold;
  }

  if (input.onHoldUntil !== undefined) {
    item.on_hold_until = input.onHoldUntil;
  }

  if (input.linkedAccountNotes !== undefined) {
    item.linked_account_notes = input.linkedAccountNotes;
  }

  return item;
};

export const serializeRazorpayTransfer = (
  transfer: RazorpayTransfer,
): RazorpayTransferResponse => ({
  id: transfer.id,
  entity: transfer.entity,
  amount: Number(transfer.amount),
  currency: transfer.currency,
  status: transfer.status,
  settlementStatus: transfer.settlement_status ?? null,
  source: transfer.source,
  recipient: transfer.recipient,
  amountReversed: transfer.amount_reversed,
  fee: transfer.fees,
  tax: transfer.tax,
  recipientSettlementId: transfer.recipient_settlement_id ?? null,
  createdAt: transfer.created_at,
  processedAt: transfer.processed_at,
  notes: transfer.notes ?? {},
  error: transfer.error ?? null,
});

export const serializeRazorpayReversal = (
  reversal: RazorpayReversal,
): RazorpayReversalResponse => ({
  id: reversal.id,
  entity: reversal.entity,
  transferId: reversal.transfer_id,
  amount: reversal.amount,
  fee: reversal.fee,
  tax: reversal.tax,
  currency: reversal.currency,
  notes: reversal.notes ?? {},
  initiatorId: reversal.initiator_id ?? null,
  customerRefundId: reversal.customer_refund_id ?? null,
  createdAt: reversal.created_at,
});

export const serializeRazorpayTransferList = (list: {
  entity: string;
  count: number;
  items: RazorpayTransfer[];
}): {
  entity: string;
  count: number;
  items: RazorpayTransferResponse[];
} => ({
  entity: list.entity,
  count: list.count,
  items: list.items.map(serializeRazorpayTransfer),
});
