import Razorpay from "razorpay";

import type {
  CreateRazorpayOrderInput,
  RazorpayOrderResponse,
  RazorpayPaymentResponse,
  RazorpayRefundResponse,
  RazorpayPluginOptions,
} from "./types.js";

type RazorpayOrderCreateRequestBody = {
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string | number | null>;
  partial_payment?: boolean;
  first_payment_min_amount?: number;
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
