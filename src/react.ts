/**
 * Pre-built TanStack Query (React Query) hooks for the Razorpay plugin.
 *
 * @example
 * ```tsx
 * import { useSubscription, useSubscriptionList } from "better-auth-razorpay-plugin/react";
 *
 * function BillingPage() {
 *   const { data: subscription, isLoading } = useSubscription(authClient);
 *   const { data: subscriptions } = useSubscriptionList(authClient);
 *   // ...
 * }
 * ```
 *
 * @module
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { Subscription } from "./types";

// ─── Type Helpers ────────────────────────────────────────────────────────────

/**
 * Any auth client that has the Razorpay plugin methods.
 * We use `any` generics to avoid coupling to a specific client shape.
 */
type RazorpayAuthClient = {
  subscription: {
    upgrade: (body: any) => Promise<any>;
    cancel: (body: any) => Promise<any>;
    list: (query?: any) => Promise<any>;
    pause: (body: any) => Promise<any>;
    resume: (body: any) => Promise<any>;
    restore: (body: any) => Promise<any>;
    update: (body: any) => Promise<any>;
    get: (query: any) => Promise<any>;
  };
  razorpay: {
    order: {
      create: (body: any) => Promise<any>;
      get: (query: any) => Promise<any>;
      edit: (body: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
      payments: (query: any) => Promise<any>;
    };
    payment: {
      get: (query: any) => Promise<any>;
      capture: (body: any) => Promise<any>;
      refund: (body: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
      edit: (body: any) => Promise<any>;
    };
    refund: {
      get: (query: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
      edit: (body: any) => Promise<any>;
    };
    invoice: {
      create: (body: any) => Promise<any>;
      get: (query: any) => Promise<any>;
      edit: (body: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
      issue: (body: any) => Promise<any>;
      delete: (body: any) => Promise<any>;
      cancel: (body: any) => Promise<any>;
      notify: (body: any) => Promise<any>;
    };
    subscription: {
      get: (query: any) => Promise<any>;
      invoices: (query: any) => Promise<any>;
      pendingUpdate: (query: any) => Promise<any>;
      addon: (body: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
    };
    plan: {
      create: (body: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
      get: (query: any) => Promise<any>;
    };
    customer: {
      create: (body: any) => Promise<any>;
      edit: (body: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
      get: (query: any) => Promise<any>;
      bankAccount: (body: any) => Promise<any>;
      bankAccountDelete: (body: any) => Promise<any>;
      tokens: (query: any) => Promise<any>;
      token: (query: any) => Promise<any>;
      tokenDelete: (body: any) => Promise<any>;
    };
    addon: {
      get: (query: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
      delete: (body: any) => Promise<any>;
    };
    item: {
      create: (body: any) => Promise<any>;
      get: (query: any) => Promise<any>;
      list: (query?: any) => Promise<any>;
      edit: (body: any) => Promise<any>;
      delete: (body: any) => Promise<any>;
    };
  };
};

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const razorpayQueryKeys = {
  all: ["razorpay"] as const,
  subscriptions: () => [...razorpayQueryKeys.all, "subscriptions"] as const,
  subscriptionList: (referenceId?: string, customerType?: string) =>
    [
      ...razorpayQueryKeys.subscriptions(),
      "list",
      { referenceId, customerType },
    ] as const,
  subscription: (subscriptionId: string) =>
    [...razorpayQueryKeys.subscriptions(), "detail", subscriptionId] as const,
  razorpaySubscription: (subscriptionId: string) =>
    [
      ...razorpayQueryKeys.subscriptions(),
      "razorpay",
      subscriptionId,
    ] as const,
  allSubscriptions: (query?: Record<string, unknown>) =>
    [
      ...razorpayQueryKeys.subscriptions(),
      "all",
      query,
    ] as const,
  subscriptionInvoices: (subscriptionId: string) =>
    [...razorpayQueryKeys.subscriptions(), "invoices", subscriptionId] as const,
  pendingUpdate: (subscriptionId: string) =>
    [
      ...razorpayQueryKeys.subscriptions(),
      "pending-update",
      subscriptionId,
    ] as const,
  plans: () => [...razorpayQueryKeys.all, "plans"] as const,
  plan: (planId: string) =>
    [...razorpayQueryKeys.plans(), "detail", planId] as const,
  payments: () => [...razorpayQueryKeys.all, "payments"] as const,
  payment: (paymentId: string) =>
    [...razorpayQueryKeys.payments(), "detail", paymentId] as const,
  refunds: () => [...razorpayQueryKeys.all, "refunds"] as const,
  refund: (refundId: string) =>
    [...razorpayQueryKeys.refunds(), "detail", refundId] as const,
  orders: () => [...razorpayQueryKeys.all, "orders"] as const,
  invoices: () => [...razorpayQueryKeys.all, "invoices"] as const,
  invoice: (invoiceId: string) =>
    [...razorpayQueryKeys.invoices(), "detail", invoiceId] as const,
  addons: () => [...razorpayQueryKeys.all, "addons"] as const,
  addon: (addonId: string) =>
    [...razorpayQueryKeys.addons(), "detail", addonId] as const,
  items: () => [...razorpayQueryKeys.all, "items"] as const,
  item: (itemId: string) =>
    [...razorpayQueryKeys.items(), "detail", itemId] as const,
  customers: () => [...razorpayQueryKeys.all, "customers"] as const,
  customer: (customerId: string) =>
    [...razorpayQueryKeys.customers(), "detail", customerId] as const,
  tokens: (customerId: string) =>
    [...razorpayQueryKeys.customers(), "tokens", customerId] as const,
  bankAccounts: (customerId: string) =>
    [...razorpayQueryKeys.customers(), "bankAccounts", customerId] as const,
};

// ─── Query Hooks ─────────────────────────────────────────────────────────────

/**
 * Fetch the list of subscriptions for the current user or reference.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSubscriptionList(authClient, {
 *   referenceId: "org_123",
 *   customerType: "organization",
 * });
 * ```
 */
export function useSubscriptionList(
  authClient: RazorpayAuthClient,
  options?: {
    referenceId?: string;
    customerType?: "user" | "organization";
    queryOptions?: Omit<
      UseQueryOptions<Subscription[], Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  const referenceId = options?.referenceId;
  const customerType = options?.customerType;

  return useQuery<Subscription[], Error>({
    queryKey: razorpayQueryKeys.subscriptionList(referenceId, customerType),
    queryFn: async () => {
      const { data, error } = await authClient.subscription.list({
        query: {
          ...(referenceId ? { referenceId } : {}),
          ...(customerType ? { customerType } : {}),
        },
      });
      if (error) throw error;
      return data as Subscription[];
    },
    ...options?.queryOptions,
  });
}

/**
 * Fetch a single subscription by its local database ID.
 *
 * @example
 * ```tsx
 * const { data: subscription } = useSubscription(authClient, "sub_123");
 * ```
 */
export function useSubscription(
  authClient: RazorpayAuthClient,
  subscriptionId: string,
  options?: {
    referenceId?: string;
    customerType?: "user" | "organization";
    queryOptions?: Omit<
      UseQueryOptions<Subscription, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<Subscription, Error>({
    queryKey: razorpayQueryKeys.subscription(subscriptionId),
    queryFn: async () => {
      const { data, error } = await authClient.subscription.get({
        query: {
          subscriptionId,
          ...(options?.referenceId ? { referenceId: options.referenceId } : {}),
          ...(options?.customerType
            ? { customerType: options.customerType }
            : {}),
        },
      });
      if (error) throw error;
      return data as Subscription;
    },
    enabled: !!subscriptionId,
    ...options?.queryOptions,
  });
}

/**
 * Fetch invoices for a Razorpay subscription.
 *
 * @example
 * ```tsx
 * const { data: invoices } = useRazorpayInvoices(authClient, "sub_rzp_123");
 * ```
 */
export function useRazorpayInvoices(
  authClient: RazorpayAuthClient,
  subscriptionId: string,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown[], Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown[], Error>({
    queryKey: razorpayQueryKeys.subscriptionInvoices(subscriptionId),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.subscription.invoices({
        query: { subscriptionId },
      });
      if (error) throw error;
      return data as unknown[];
    },
    enabled: !!subscriptionId,
    ...options?.queryOptions,
  });
}

/**
 * Fetch a Razorpay subscription by its Razorpay ID (not local DB ID).
 *
 * @example
 * ```tsx
 * const { data } = useRazorpaySubscription(authClient, "sub_rzp_123");
 * ```
 */
export function useRazorpaySubscription(
  authClient: RazorpayAuthClient,
  subscriptionId: string,
  options?: {
    queryOptions?: Omit<UseQueryOptions<unknown, Error>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: razorpayQueryKeys.razorpaySubscription(subscriptionId),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.subscription.get({
        query: { subscriptionId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!subscriptionId,
    ...options?.queryOptions,
  });
}

/**
 * Fetch all Razorpay plans.
 *
 * @example
 * ```tsx
 * const { data: plans } = useRazorpayPlans(authClient);
 * ```
 */
export function useRazorpayPlans(
  authClient: RazorpayAuthClient,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown[], Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown[], Error>({
    queryKey: razorpayQueryKeys.plans(),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.plan.list({});
      if (error) throw error;
      return data as unknown[];
    },
    ...options?.queryOptions,
  });
}

/**
 * Fetch a pending update for a subscription.
 *
 * @example
 * ```tsx
 * const { data } = useSubscriptionPendingUpdate(authClient, "sub_rzp_123");
 * ```
 */
export function useSubscriptionPendingUpdate(
  authClient: RazorpayAuthClient,
  subscriptionId: string,
  options?: {
    queryOptions?: Omit<UseQueryOptions<unknown, Error>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: razorpayQueryKeys.pendingUpdate(subscriptionId),
    queryFn: async () => {
      const { data, error } =
        await authClient.razorpay.subscription.pendingUpdate({
          query: { subscriptionId },
        });
      if (error) throw error;
      return data;
    },
    enabled: !!subscriptionId,
    ...options?.queryOptions,
  });
}

// ─── Payment Query Hooks ─────────────────────────────────────────────────────

/**
 * Fetch all payments from Razorpay with optional filters and pagination.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useRazorpayPaymentList(authClient, { count: 10 });
 * ```
 */
export function useRazorpayPaymentList(
  authClient: RazorpayAuthClient,
  query?: {
    count?: number;
    skip?: number;
    from?: number;
    to?: number;
    expand?: string;
    referenceId?: string;
  },
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.payments(), query],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.payment.list({
        query: { ...(query || {}) },
      });
      if (error) throw error;
      return data;
    },
    ...options?.queryOptions,
  });
}

/**
 * Fetch a single Razorpay payment by ID.
 *
 * @example
 * ```tsx
 * const { data: payment } = useRazorpayPayment(authClient, "pay_123");
 * ```
 */
export function useRazorpayPayment(
  authClient: RazorpayAuthClient,
  paymentId: string,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: razorpayQueryKeys.payment(paymentId),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.payment.get({
        query: { id: paymentId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!paymentId,
    ...options?.queryOptions,
  });
}

// ─── Subscription Query Hooks (from Razorpay API) ────────────────────────────

/**
 * Fetch all subscriptions directly from the Razorpay API.
 * Supports filtering by plan, status, and time range.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useRazorpaySubscriptions(authClient, { count: 10 });
 * ```
 */
export function useRazorpaySubscriptions(
  authClient: RazorpayAuthClient,
  query?: {
    from?: number;
    to?: number;
    count?: number;
    skip?: number;
    planId?: string;
    status?: string;
    expand?: string;
  },
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: razorpayQueryKeys.allSubscriptions(query),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.subscription.list({
        query: { ...(query || {}) },
      });
      if (error) throw error;
      return data;
    },
    ...options?.queryOptions,
  });
}

// ─── Refund Query Hooks ──────────────────────────────────────────────────────

/**
 * Fetch all refunds from Razorpay with pagination.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayRefundList(authClient, { count: 10 });
 * ```
 */
export function useRazorpayRefundList(
  authClient: RazorpayAuthClient,
  query?: {
    count?: number;
    skip?: number;
    from?: number;
    to?: number;
  },
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.refunds(), query],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.refund.list({
        query: { ...(query || {}) },
      });
      if (error) throw error;
      return data;
    },
    ...options?.queryOptions,
  });
}

/**
 * Fetch a single refund by ID.
 *
 * @example
 * ```tsx
 * const { data: refund } = useRazorpayRefund(authClient, "rfnd_123");
 * ```
 */
export function useRazorpayRefund(
  authClient: RazorpayAuthClient,
  refundId: string,
  query?: { paymentId?: string },
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.refund(refundId), query],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.refund.get({
        query: { refundId, ...(query || {}) },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!refundId,
    ...options?.queryOptions,
  });
}

// ─── Invoice Query Hooks ─────────────────────────────────────────────────────

/**
 * Fetch all invoices from Razorpay with optional filters and pagination.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayInvoiceList(authClient, { count: 10 });
 * ```
 */
export function useRazorpayInvoiceList(
  authClient: RazorpayAuthClient,
  query?: {
    count?: number;
    skip?: number;
    from?: number;
    to?: number;
    customer_id?: string;
    subscription_id?: string;
    payment_id?: string;
  },
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.invoices(), query],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.invoice.list({
        query: { ...(query || {}) },
      });
      if (error) throw error;
      return data;
    },
    ...options?.queryOptions,
  });
}

/**
 * Fetch a single invoice by ID.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayInvoice(authClient, "inv_123");
 * ```
 */
export function useRazorpayInvoice(
  authClient: RazorpayAuthClient,
  invoiceId: string,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: razorpayQueryKeys.invoice(invoiceId),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.invoice.get({
        query: { invoiceId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId,
    ...options?.queryOptions,
  });
}

// ─── Order Query Hooks ───────────────────────────────────────────────────────

/**
 * Fetch all orders from Razorpay with pagination and optional filters.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayOrderList(authClient, { count: 10 });
 * ```
 */
export function useRazorpayOrderList(
  authClient: RazorpayAuthClient,
  query?: {
    count?: number;
    skip?: number;
    from?: number;
    to?: number;
    authorized?: boolean;
    receipt?: string;
    expand?: string;
  },
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.orders(), query],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.order.list({
        query: { ...(query || {}) },
      });
      if (error) throw error;
      return data;
    },
    ...options?.queryOptions,
  });
}

/**
 * Fetch all payments for a given order.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayOrderPayments(authClient, "order_123");
 * ```
 */
export function useRazorpayOrderPayments(
  authClient: RazorpayAuthClient,
  orderId: string,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.orders(), "payments", orderId],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.order.payments({
        query: { orderId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
    ...options?.queryOptions,
  });
}

// ─── Add-on Query Hooks ──────────────────────────────────────────────────────

/**
 * Fetch all add-ons from Razorpay with pagination.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayAddonList(authClient, { count: 10 });
 * ```
 */
export function useRazorpayAddonList(
  authClient: RazorpayAuthClient,
  query?: {
    count?: number;
    skip?: number;
    from?: number;
    to?: number;
  },
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.addons(), query],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.addon.list({
        query: { ...(query || {}) },
      });
      if (error) throw error;
      return data;
    },
    ...options?.queryOptions,
  });
}

/**
 * Fetch a single add-on by ID.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayAddon(authClient, "addon_123");
 * ```
 */
export function useRazorpayAddon(
  authClient: RazorpayAuthClient,
  addonId: string,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: razorpayQueryKeys.addon(addonId),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.addon.get({
        query: { addonId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!addonId,
    ...options?.queryOptions,
  });
}

// ─── Item Query Hooks ─────────────────────────────────────────────────────────

/**
 * Fetch all items from Razorpay with pagination.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayItemList(authClient, { count: 10 });
 * ```
 */
export function useRazorpayItemList(
  authClient: RazorpayAuthClient,
  query?: {
    count?: number;
    skip?: number;
    from?: number;
    to?: number;
    active?: number;
  },
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.items(), query],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.item.list({
        query: { ...(query || {}) },
      });
      if (error) throw error;
      return data;
    },
    ...options?.queryOptions,
  });
}

/**
 * Fetch a single item by ID.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayItem(authClient, "item_123");
 * ```
 */
export function useRazorpayItem(
  authClient: RazorpayAuthClient,
  itemId: string,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: razorpayQueryKeys.item(itemId),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.item.get({
        query: { itemId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
    ...options?.queryOptions,
  });
}

// ─── Customer Query Hooks ────────────────────────────────────────────────────

/**
 * Fetch all customer tokens for a customer.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayCustomerTokens(authClient, "cust_123");
 * ```
 */
export function useRazorpayCustomerTokens(
  authClient: RazorpayAuthClient,
  customerId: string,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: razorpayQueryKeys.tokens(customerId),
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.customer.tokens({
        query: { customerId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
    ...options?.queryOptions,
  });
}

/**
 * Fetch a specific token for a customer.
 *
 * @example
 * ```tsx
 * const { data } = useRazorpayCustomerToken(authClient, "cust_123", "token_123");
 * ```
 */
export function useRazorpayCustomerToken(
  authClient: RazorpayAuthClient,
  customerId: string,
  tokenId: string,
  options?: {
    queryOptions?: Omit<
      UseQueryOptions<unknown, Error>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<unknown, Error>({
    queryKey: [...razorpayQueryKeys.tokens(customerId), tokenId],
    queryFn: async () => {
      const { data, error } = await authClient.razorpay.customer.token({
        query: { customerId, tokenId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId && !!tokenId,
    ...options?.queryOptions,
  });
}

// ─── Mutation Hooks ──────────────────────────────────────────────────────────

/**
 * Upgrade or create a subscription.
 *
 * @example
 * ```tsx
 * const upgrade = useUpgradeSubscription(authClient);
 * upgrade.mutate({ plan: "pro", annual: true });
 * ```
 */
export function useUpgradeSubscription(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      plan: string;
      referenceId?: string;
      customerType?: "user" | "organization";
      annual?: boolean;
      metadata?: Record<string, unknown>;
      lineItems?: { item_id: string; quantity?: number }[];
      scheduleAtPeriodEnd?: boolean;
    }) => {
      const { data, error } = await authClient.subscription.upgrade(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.subscriptions(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Cancel a subscription.
 *
 * @example
 * ```tsx
 * const cancel = useCancelSubscription(authClient);
 * cancel.mutate({ cancelAtCycleEnd: true });
 * ```
 */
export function useCancelSubscription(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      referenceId?: string;
      customerType?: "user" | "organization";
      cancelAtCycleEnd?: boolean;
    }) => {
      const { data, error } = await authClient.subscription.cancel(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.subscriptions(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Pause a subscription.
 */
export function usePauseSubscription(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      referenceId?: string;
      customerType?: "user" | "organization";
      pauseAt?: "now";
    }) => {
      const { data, error } = await authClient.subscription.pause(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.subscriptions(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Resume a paused subscription.
 */
export function useResumeSubscription(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      referenceId?: string;
      customerType?: "user" | "organization";
      resumeAt?: "now";
    }) => {
      const { data, error } = await authClient.subscription.resume(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.subscriptions(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Restore a subscription that was scheduled for cancellation at cycle end.
 */
export function useRestoreSubscription(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      referenceId?: string;
      customerType?: "user" | "organization";
    }) => {
      const { data, error } = await authClient.subscription.restore(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.subscriptions(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Update a subscription (plan change, quantity, metadata, etc).
 *
 * @example
 * ```tsx
 * const update = useUpdateSubscription(authClient);
 * update.mutate({ quantity: 5, metadata: { team: "engineering" } });
 * ```
 */
export function useUpdateSubscription(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      referenceId?: string;
      customerType?: "user" | "organization";
      planId?: string;
      quantity?: number;
      remainingCount?: number;
      scheduleChangeAt?: "now" | "cycle_end";
      metadata?: Record<string, unknown>;
      lineItems?: { item_id: string; quantity?: number }[];
    }) => {
      const { data, error } = await authClient.subscription.update(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.subscriptions(),
      });
    },
    ...options?.mutationOptions,
  });
}

// ─── Refund Mutation Hooks ───────────────────────────────────────────────────

/**
 * Edit notes on an existing refund.
 *
 * @example
 * ```tsx
 * const edit = useEditRefund(authClient);
 * edit.mutate({ refundId: "rfnd_123", notes: { reason: "customer_request" } });
 * ```
 */
export function useEditRefund(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      refundId: string;
      notes: Record<string, string | number>;
    }) => {
      const { data, error } = await authClient.razorpay.refund.edit(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: razorpayQueryKeys.refunds() });
    },
    ...options?.mutationOptions,
  });
}

// ─── Invoice Mutation Hooks ──────────────────────────────────────────────────

/**
 * Create a standalone invoice.
 *
 * @example
 * ```tsx
 * const create = useCreateInvoice(authClient);
 * create.mutate({ line_items: [{ id: "item_1", quantity: 1 }], currency: "INR" });
 * ```
 */
export function useCreateInvoice(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await authClient.razorpay.invoice.create(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.invoices(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Edit an existing invoice.
 */
export function useEditInvoice(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await authClient.razorpay.invoice.edit(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.invoices(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Issue a draft invoice.
 */
export function useIssueInvoice(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { invoiceId: string }) => {
      const { data, error } = await authClient.razorpay.invoice.issue(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.invoices(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Delete a draft invoice.
 */
export function useDeleteInvoice(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { invoiceId: string }) => {
      const { data, error } = await authClient.razorpay.invoice.delete(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.invoices(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Cancel an issued invoice.
 */
export function useCancelInvoice(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { invoiceId: string }) => {
      const { data, error } = await authClient.razorpay.invoice.cancel(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.invoices(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Send an SMS or email notification for an invoice.
 */
export function useNotifyByInvoice(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  return useMutation({
    mutationFn: async (body: {
      invoiceId: string;
      medium: "email" | "sms";
    }) => {
      const { data, error } = await authClient.razorpay.invoice.notify(body);
      if (error) throw error;
      return data;
    },
    ...options?.mutationOptions,
  });
}

// ─── Order Mutation Hooks ────────────────────────────────────────────────────

/**
 * Edit notes on an existing order.
 */
export function useEditOrder(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { orderId: string; notes: Record<string, string | number> }) => {
      const { data, error } = await authClient.razorpay.order.edit(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: razorpayQueryKeys.orders() });
    },
    ...options?.mutationOptions,
  });
}

// ─── Payment Mutation Hooks ──────────────────────────────────────────────────

/**
 * Edit notes on an existing payment.
 */
export function useEditPayment(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      paymentId: string;
      notes: Record<string, string | number>;
    }) => {
      const { data, error } = await authClient.razorpay.payment.edit(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.payments(),
      });
    },
    ...options?.mutationOptions,
  });
}

// ─── Customer Mutation Hooks ─────────────────────────────────────────────────

/**
 * Add a bank account to a customer.
 */
export function useAddBankAccount(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      customerId: string;
      ifsc_code: string;
      account_number: string;
      beneficiary_name?: string;
    }) => {
      const { data, error } =
        await authClient.razorpay.customer.bankAccount(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.customers(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Delete a bank account from a customer.
 */
export function useDeleteBankAccount(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      customerId: string;
      bankAccountId: string;
    }) => {
      const { data, error } =
        await authClient.razorpay.customer.bankAccountDelete(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.customers(),
      });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Delete a saved token for a customer.
 */
export function useDeleteToken(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { customerId: string; tokenId: string }) => {
      const { data, error } =
        await authClient.razorpay.customer.tokenDelete(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.customers(),
      });
    },
    ...options?.mutationOptions,
  });
}

// ─── Subscription Add-on Mutation Hook ────────────────────────────────────────

/**
 * Create an add-on for a subscription.
 */
export function useCreateSubscriptionAddon(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      subscriptionId: string;
      item: { id: string } | { name: string; amount: number; currency: string; description?: string };
      quantity?: number;
    }) => {
      const { data, error } =
        await authClient.razorpay.subscription.addon(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: razorpayQueryKeys.subscriptions(),
      });
    },
    ...options?.mutationOptions,
  });
}

// ─── Add-on Mutation Hook ────────────────────────────────────────────────────

/**
 * Delete an add-on by ID.
 */
export function useDeleteAddon(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { addonId: string }) => {
      const { data, error } = await authClient.razorpay.addon.delete(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: razorpayQueryKeys.addons() });
    },
    ...options?.mutationOptions,
  });
}

// ─── Item Mutation Hooks ─────────────────────────────────────────────────────

/**
 * Create a new item.
 */
export function useCreateItem(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await authClient.razorpay.item.create(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: razorpayQueryKeys.items() });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Edit an existing item.
 */
export function useEditItem(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await authClient.razorpay.item.edit(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: razorpayQueryKeys.items() });
    },
    ...options?.mutationOptions,
  });
}

/**
 * Delete an item by ID.
 */
export function useDeleteItem(
  authClient: RazorpayAuthClient,
  options?: {
    mutationOptions?: Omit<UseMutationOptions<any, Error, any>, "mutationFn">;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { itemId: string }) => {
      const { data, error } = await authClient.razorpay.item.delete(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: razorpayQueryKeys.items() });
    },
    ...options?.mutationOptions,
  });
}

// ─── Status Helpers Hook ─────────────────────────────────────────────────────

/**
 * Derived subscription status helpers.
 * Wraps the subscription data with boolean status flags.
 *
 * @example
 * ```tsx
 * const { isActive, isPaused, isTrialing, canRestore } = useSubscriptionStatus(subscription);
 * ```
 */
export function useSubscriptionStatus(subscription: Subscription | null | undefined) {
  if (!subscription) {
    return {
      isActive: false,
      isAuthenticated: false,
      isPaused: false,
      isCancelled: false,
      isCompleted: false,
      isExpired: false,
      isHalted: false,
      isPending: false,
      isTrialing: false,
      isUsable: false,
      isTerminal: false,
      hasPaymentIssue: false,
      canRestore: false,
    };
  }

  const status = subscription.status;
  const isActive = status === "active";
  const isAuthenticated = status === "authenticated";
  const isPaused = status === "paused";
  const isCancelled = status === "cancelled";
  const isTrialing =
    isAuthenticated &&
    subscription.trialStart !== undefined &&
    subscription.trialStart !== null &&
    (subscription.trialEnd === undefined || subscription.trialEnd === null);

  return {
    isActive,
    isAuthenticated,
    isPaused,
    isCancelled,
    isCompleted: status === "completed",
    isExpired: status === "expired",
    isHalted: status === "halted",
    isPending: status === "pending",
    isTrialing,
    isUsable: isActive || isAuthenticated,
    isTerminal: isCancelled || status === "completed" || status === "expired",
    hasPaymentIssue: status === "pending" || status === "halted",
    canRestore: subscription.cancelAtCycleEnd === true && isActive,
  };
}
