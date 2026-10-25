# @amank-root/better-auth-razorpay

Full [Razorpay](https://razorpay.com) integration plugin for [Better Auth](https://better-auth.com/) — subscriptions, one-time payments, invoices, refunds, customers, add-ons, items, and webhook handling.

> A Better Auth plugin that bridges Razorpay's subscription and payment APIs with Better Auth's authentication and database layer.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Basic Setup](#basic-setup)
  - [Subscription Plans](#subscription-plans)
  - [Organization Mode](#organization-mode)
  - [Webhook Setup](#webhook-setup)
  - [Optional: Pre-built Razorpay Client](#optional-pre-built-razorpay-client)
- [Server-Side API](#server-side-api)
  - [One-Time Payments](#one-time-payments)
  - [Subscription Management](#subscription-management)
  - [Invoices](#invoices)
  - [Refunds](#refunds)
  - [Orders](#orders)
  - [Payments](#payments)
  - [Customers](#customers)
  - [Add-ons](#addons)
  - [Items](#items)
  - [Plans](#plans)
- [Webhook Event Handlers](#webhook-event-handlers)
- [React Hooks (`@tanstack/react-query`)](#react-hooks)
- [Types](#types)
  - [Subscription Status Helpers](#subscription-status-helpers)
- [Error Codes](#error-codes)
- [Testing](#testing)
- [Development](#development)
- [License](#license)

---

## Installation

```bash
npm install @amank-root/better-auth-razorpay
# or
yarn add @amank-root/better-auth-razorpay
# or
pnpm add @amank-root/better-auth-razorpay
# or
bun add @amank-root/better-auth-razorpay
```

### Peer Dependencies

| Package             | Version  |
|---------------------|----------|
| `better-auth`       | `^1.7.0` |
| `@better-auth/core` | `^1.7.0` |
| `typescript`        | `^5.6.3` |

`@tanstack/react-query` and `react` are optional peer dependencies required only if you use the React hooks.

---

## Quick Start

```ts
// src/auth.ts
import { betterAuth } from "better-auth";
import { razorpayPlugin } from "@amank-root/better-auth-razorpay";

export const auth = betterAuth({
  database: yourDatabaseConfig,
  plugins: [
    razorpayPlugin({
      keyId: process.env.RAZORPAY_KEY_ID!,
      keySecret: process.env.RAZORPAY_KEY_SECRET!,
      razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!,
      defaultCurrency: "INR",
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            planId: "plan_monthly_100",
            annualPlanId: "plan_annual_100",
            name: "pro",
            totalCount: 12,
            quantity: false,
            freeTrial: { days: 7 },
          },
        ],
      },
    }),
  ],
});
```

```ts
// src/server.ts (Node/Express example)
import express from "express";
import { auth } from "./auth";

const app = express();

// Serve Better Auth routes (includes razorpay plugin endpoints)
app.all("/api/auth/*", auth.handler);

app.listen(3000);
```

---

## Configuration

### Basic Setup

```ts
razorpayPlugin({
  keyId: process.env.RAZORPAY_KEY_ID!,
  keySecret: process.env.RAZORPAY_KEY_SECRET!,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!,
  defaultCurrency: "INR", // optional, defaults to INR
  createCustomerOnSignUp: true, // optional, defaults to false
})
```

### Subscription Plans

Enable subscription management by providing `subscription: { enabled: true, plans: [...] }`:

```ts
razorpayPlugin({
  keyId: process.env.RAZORPAY_KEY_ID!,
  keySecret: process.env.RAZORPAY_KEY_SECRET!,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!,
  subscription: {
    enabled: true,
    plans: [
      {
        planId: "plan_monthly_100",
        annualPlanId: "plan_annual_100",
        name: "pro",
        group: "default",
        totalCount: 12,
        quantity: false,
        limits: { seats: 5 },
        freeTrial: {
          days: 7,
          onTrialStart: async (subscription) => { /* ... */ },
          onTrialEnd: async (data, ctx) => { /* ... */ },
          onTrialExpired: async (subscription, ctx) => { /* ... */ },
        },
      },
    ],
  },
})
```

### Organization Mode

Enable organization-level subscriptions by combining with the `organization` plugin from Better Auth:

```ts
import { organizationPlugin } from "better-auth/plugins/organization";

export const auth = betterAuth({
  plugins: [
    organizationPlugin(),
    razorpayPlugin({
      // ...
      subscription: {
        enabled: true,
        plans: [/* ... */],
      },
      organization: {
        enabled: true,
        getCustomerCreateParams: async (org, ctx) => {
          return { name: org.name };
        },
        onCustomerCreate: async ({ razorpayCustomer, organization }) => {
          // Sync customer ID to your database
        },
      },
    }),
  ],
});
```

### Webhook Setup

The plugin processes Razorpay webhook events for subscription lifecycle management, payment handling, and invoice/ refund events. Configure your webhook endpoint in the [Razorpay Dashboard](https://dashboard.razorpay.com):

```ts
razorpayPlugin({
  // ...
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!,
  onEvent: async (event) => {
    // Called for every webhook event
  },
  onPaymentAuthorized: async ({ event, payment }) => { /* ... */ },
  onPaymentCaptured: async ({ event, payment }) => { /* ... */ },
  onPaymentFailed: async ({ event, payment }) => { /* ... */ },
  onOrderPaid: async ({ event, order }) => { /* ... */ },
  onRefundCreated: async ({ event, refund }) => { /* ... */ },
  onRefundProcessed: async ({ event, refund }) => { /* ... */ },
  onRefundFailed: async ({ event, refund }) => { /* ... */ },
  onInvoicePaid: async ({ event, invoice }) => { /* ... */ },
  onInvoicePartiallyPaid: async ({ event, invoice }) => { /* ... */ },
  onInvoiceExpired: async ({ event, invoice }) => { /* ... */ },
  onSubscriptionActivated: async ({ event, razorpaySubscription, subscription, plan }) => { /* ... */ },
  onSubscriptionCharged: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionAuthenticated: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionCancelled: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionPaused: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionResumed: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionHalted: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionPending: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionCompleted: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionUpdated: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionRenewed: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
  onSubscriptionOfferUpdated: async ({ event, razorpaySubscription, subscription }) => { /* ... */ },
})
```

### Optional: Pre-built Razorpay Client

Instead of providing `keyId` and `keySecret`, you can pass a pre-built `Razorpay` client instance:

```ts
import Razorpay from "razorpay";

razorpayPlugin({
  razorpayClient: new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  }),
  // ...
})
```

---

## Server-Side API

All endpoints are available under the Better Auth route handler (`/api/auth/*`).

### One-Time Payments

| Method | Path                         | Description                                      |
|--------|------------------------------|--------------------------------------------------|
| `POST` | `/razorpay/create-order`     | Create a Razorpay order for one-time payment     |
| `GET`  | `/razorpay/order`            | Fetch order details by ID                        |
| `POST` | `/razorpay/verify-payment`   | Verify payment signature and status with Razorpay      |
| `POST` | `/razorpay/payment/capture`  | Capture an authorized payment                      |
| `POST` | `/razorpay/payment/refund`   | Refund a payment                                  |

**Example: Create an order**

```ts
const order = await auth.api.razorpayCreateOrder({
  body: {
    amount: 50000,
    currency: "INR",
    receipt: "receipt_001",
    notes: { order_id: "ORD_123" },
  },
});
```

**Example: Verify a payment**

```ts
const result = await auth.api.razorpayVerifyPayment({
  body: {
    razorpayOrderId: "order_123",
    razorpayPaymentId: "pay_123",
    razorpaySignature: "signature_from_client",
    // optional: reject payments whose amount doesn't match
    expectedAmount: 50000, // in subunits (paise); 50000 = ₹500
  },
});
// result =>
//   { valid: true, paymentStatus: "captured", amount: 50000, currency: "INR", orderId: "order_123" }
//   on failure:
//   { valid: false, paymentStatus: "failed", amount: 50000, reason: "payment_not_captured" }
```

> **Security:** The verify-payment endpoint now fetches the payment from
> Razorpay and checks that the status is `"captured"`, the `order_id` matches,
> and (if provided) the `amount` matches `expectedAmount`. A valid signature
> alone is **not sufficient** to provision goods — a malicious user could
> submit a valid signature for a failed payment. Only fulfill orders on the
> `order.paid` webhook event.

**Example: Verify with expected amount**

```ts
const result = await auth.api.razorpayVerifyPayment({
  body: {
    razorpayOrderId: "order_123",
    razorpayPaymentId: "pay_123",
    razorpaySignature: "signature_from_client",
    expectedAmount: 50000,
  },
});

if (result.valid) {
  // Payment is verified AND captured — provision the goods
  await provisionOrder(result.orderId);
} else {
  // Payment is not captured (e.g. failed, authorized-but-not-captured,
  // amount mismatch, or order mismatch)
  console.warn("Payment not valid:", result.reason);
}
```

### Subscription Management

| Method | Path                        | Description                                              |
|--------|-----------------------------|----------------------------------------------------------|
| `POST` | `/subscription/upgrade`     | Upgrade or create a subscription                         |
| `POST` | `/subscription/cancel`      | Cancel a subscription (immediately or at cycle end)      |
| `POST` | `/subscription/pause`       | Pause an active subscription                             |
| `POST` | `/subscription/resume`      | Resume a paused subscription                             |
| `POST` | `/subscription/restore`     | Restore a subscription scheduled for cancellation        |
| `POST` | `/subscription/update`      | Update plan, quantity, metadata, or schedule changes     |
| `GET`  | `/subscription/list`        | List subscriptions for the current user/organization     |
| `GET`  | `/subscription/get`         | Fetch a single subscription by local ID                  |
| `GET`  | `/razorpay/subscription/get` | Fetch a subscription by Razorpay ID                     |
| `GET`  | `/razorpay/subscription/list` | List all subscriptions directly from the Razorpay API  |
| `GET`  | `/razorpay/subscription/invoices` | List invoices for a subscription                  |
| `GET`  | `/razorpay/subscription/pending-update` | Fetch pending update for a subscription      |

**Example: Upgrade to an annual plan**

```ts
const result = await auth.api.subscriptionUpgrade({
  body: {
    plan: "pro",
    annual: true,
    quantity: 5,
    metadata: { team: "engineering" },
    lineItems: [{ item_id: "item_1", quantity: 5 }],
  },
});
```

**Example: Cancel at cycle end**

```ts
await auth.api.subscriptionCancel({
  body: { cancelAtCycleEnd: true },
});
```

### Invoices

| Method | Path                          | Description                                    |
|--------|-------------------------------|------------------------------------------------|
| `POST` | `/razorpay/invoice/create`    | Create a standalone invoice                    |
| `GET`  | `/razorpay/invoice/get`       | Fetch invoice by ID                            |
| `POST` | `/razorpay/invoice/edit`      | Edit an existing invoice                       |
| `GET`  | `/razorpay/invoice/list`      | List all invoices with filters                  |
| `POST` | `/razorpay/invoice/issue`     | Issue a draft invoice                           |
| `POST` | `/razorpay/invoice/delete`    | Delete a draft invoice                          |
| `POST` | `/razorpay/invoice/cancel`    | Cancel an issued invoice                        |
| `POST` | `/razorpay/invoice/notify`    | Send email/SMS notification for an invoice      |

### Refunds

| Method | Path                        | Description                           |
|--------|-----------------------------|---------------------------------------|
| `GET`  | `/razorpay/refund/get`      | Fetch a single refund by ID           |
| `GET`  | `/razorpay/refund/list`     | List all refunds with pagination      |
| `POST` | `/razorpay/refund/edit`     | Edit notes on an existing refund      |

### Orders

| Method | Path                            | Description                                   |
|--------|---------------------------------|-----------------------------------------------|
| `GET`  | `/razorpay/order/list`          | List all orders with optional filters         |
| `POST` | `/razorpay/order/edit`          | Edit notes on an existing order               |
| `GET`  | `/razorpay/order/payments`      | Fetch all payments for a given order          |

### Payments

| Method | Path                       | Description                              |
|--------|----------------------------|------------------------------------------|
| `GET`  | `/razorpay/payment/list`   | List all payments with filters & pagination|
| `POST` | `/razorpay/payment/edit`   | Edit notes on an existing payment        |

### Customers

| Method | Path                                   | Description                                  |
|--------|----------------------------------------|----------------------------------------------|
| `POST` | `/razorpay/customer/create`            | Create a Razorpay customer                   |
| `POST` | `/razorpay/customer/edit`              | Edit customer details                         |
| `GET`  | `/razorpay/customer/list`              | List all customers                            |
| `GET`  | `/razorpay/customer/get`               | Fetch a customer by ID                        |
| `POST` | `/razorpay/customer/bank-account`      | Add a bank account to a customer              |
| `POST` | `/razorpay/customer/bank-account/delete` | Remove a bank account from a customer     |
| `GET`  | `/razorpay/customer/tokens`            | List all tokens for a customer                |
| `GET`  | `/razorpay/customer/token`             | Fetch a specific token                        |
| `POST` | `/razorpay/customer/token/delete`      | Delete a saved payment token                  |

**Example: Add a bank account**

```ts
await auth.api.razorpayCustomerBankAccount({
  body: {
    customerId: "cust_123",
    ifsc_code: "HDFC0001234",
    account_number: "123456789012",
    beneficiary_name: "John Doe",
  },
});
```

### Add-ons

| Method | Path                       | Description                                   |
|--------|----------------------------|-----------------------------------------------|
| `GET`  | `/razorpay/addon/get`      | Fetch an add-on by ID                         |
| `GET`  | `/razorpay/addon/list`     | List all add-ons with pagination              |
| `POST` | `/razorpay/addon/delete`   | Delete an add-on                              |
| `POST` | `/razorpay/subscription/addon` | Create an add-on for a subscription        |

**Example: Create a subscription add-on**

```ts
await auth.api.createSubscriptionAddon({
  body: {
    subscriptionId: "sub_rzp_123",
    item: { id: "item_123" },
    quantity: 2,
  },
});
```

### Items

| Method | Path                     | Description                              |
|--------|--------------------------|------------------------------------------|
| `POST` | `/razorpay/item/create`  | Create a new item                        |
| `GET`  | `/razorpay/item/get`     | Fetch an item by ID                      |
| `GET`  | `/razorpay/item/list`    | List all items with pagination           |
| `POST` | `/razorpay/item/edit`    | Edit an existing item                    |
| `POST` | `/razorpay/item/delete`  | Delete an item                           |

### Plans

| Method | Path                   | Description                          |
|--------|------------------------|--------------------------------------|
| `POST` | `/razorpay/plan/create` | Create a new plan                     |
| `GET`  | `/razorpay/plan/list`  | List all plans                        |
| `GET`  | `/razorpay/plan/get`   | Fetch a plan by ID                    |

---

## Webhook Event Handlers

The plugin processes the following Razorpay webhook events and maps them to callbacks:

| Event                   | Callback               |
|-------------------------|------------------------|
| `payment.authorized`    | `onPaymentAuthorized`  |
| `payment.captured`      | `onPaymentCaptured`    |
| `payment.failed`        | `onPaymentFailed`      |
| `order.paid`            | `onOrderPaid`          |
| `refund.created`        | `onRefundCreated`      |
| `refund.processed`      | `onRefundProcessed`    |
| `refund.failed`         | `onRefundFailed`       |
| `invoice.paid`          | `onInvoicePaid`        |
| `invoice.partially_paid`| `onInvoicePartiallyPaid` |
| `invoice.expired`       | `onInvoiceExpired`     |
| `subscription.authenticated` | `onSubscriptionAuthenticated` |
| `subscription.activated`    | `onSubscriptionActivated`   |
| `subscription.charged`      | `onSubscriptionCharged`     |
| `subscription.cancelled`    | `onSubscriptionCancelled`     |
| `subscription.paused`       | `onSubscriptionPaused`        |
| `subscription.resumed`      | `onSubscriptionResumed`       |
| `subscription.halted`       | `onSubscriptionHalted`        |
| `subscription.pending`      | `onSubscriptionPending`       |
| `subscription.completed`    | `onSubscriptionCompleted`     |
| `subscription.updated`      | `onSubscriptionUpdated`       |
| `subscription.renewed`      | `onSubscriptionRenewed`       |
| `subscription.offer_updated`| `onSubscriptionOfferUpdated`  |

All events also trigger the generic `onEvent` callback.

---

## React Hooks

The plugin ships with pre-built [TanStack React Query](https://tanstack.com/query/latest) hooks. These are typed against your auth client's `$Infer` type.

```tsx
import {
  useSubscription,
  useSubscriptionList,
  useUpgradeSubscription,
  useCancelSubscription,
  useUpdateSubscription,
  usePauseSubscription,
  useResumeSubscription,
  useRestoreSubscription,
  useRazorpayPlans,
  useRazorpaySubscription,
  useRazorpayInvoices,
  useSubscriptionPendingUpdate,
} from "@amank-root/better-auth-razorpay/react";
import { authClient } from "./lib/auth-client";

function SubscriptionPage() {
  const { data: subscriptions, isLoading } = useSubscriptionList(authClient);
  const upgrade = useUpgradeSubscription(authClient);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {subscriptions?.map((sub) => (
        <div key={sub.id}>{sub.plan}</div>
      ))}
      <button
        onClick={() => upgrade.mutate({ plan: "pro", annual: true })}
      >
        Upgrade
      </button>
    </div>
  );
}
```

### Subscription Hooks

| Hook                           | Description                                         |
|--------------------------------|-----------------------------------------------------|
| `useSubscriptionList`          | Fetch subscriptions from local DB with filters       |
| `useSubscription`              | Fetch a single subscription by local DB ID           |
| `useUpgradeSubscription`       | Upgrade/create a subscription (mutation)             |
| `useCancelSubscription`        | Cancel a subscription (mutation)                     |
| `useUpdateSubscription`        | Update subscription details (mutation)               |
| `usePauseSubscription`         | Pause a subscription (mutation)                      |
| `useResumeSubscription`        | Resume a subscription (mutation)                     |
| `useRestoreSubscription`       | Restore a cancelled subscription (mutation)           |
| `useRazorpaySubscription`      | Fetch subscription by Razorpay ID                    |
| `useRazorpaySubscriptions`     | Fetch all subscriptions from Razorpay API            |
| `useRazorpayInvoices`          | Fetch invoices for a subscription                    |
| `useRazorpayPlans`             | Fetch all plans                                      |
| `useSubscriptionPendingUpdate` | Fetch pending subscription update                    |
| `useSubscriptionStatus`        | Derive boolean status flags from subscription data   |
| `useCreateSubscriptionAddon`   | Create an add-on for a subscription (mutation)       |

### Refund Hooks

| Hook              | Description                     |
|-------------------|---------------------------------|
| `useRazorpayRefundList` | List all refunds           |
| `useRazorpayRefund`      | Fetch a single refund      |
| `useEditRefund`          | Edit a refund (mutation)   |

### Invoice Hooks

| Hook                | Description                      |
|---------------------|----------------------------------|
| `useRazorpayInvoiceList` | List all invoices            |
| `useRazorpayInvoice`      | Fetch a single invoice     |
| `useCreateInvoice`       | Create an invoice (mutation) |
| `useEditInvoice`         | Edit an invoice (mutation)   |
| `useIssueInvoice`        | Issue a draft invoice (mutation) |
| `useDeleteInvoice`       | Delete an invoice (mutation) |
| `useCancelInvoice`      | Cancel an invoice (mutation)  |
| `useNotifyByInvoice`    | Send invoice notification (mutation) |

### Order Hooks

| Hook                   | Description                    |
|------------------------|--------------------------------|
| `useRazorpayOrderList` | List all orders                |
| `useRazorpayOrderPayments` | Fetch payments for an order |
| `useEditOrder`         | Edit an order (mutation)       |

### Payment Hooks

| Hook              | Description                  |
|-------------------|------------------------------|
| `useRazorpayPaymentList` | List all payments     |
| `useRazorpayPayment`      | Fetch a single payment |
| `useEditPayment`          | Edit a payment (mutation) |

### Customer Hooks

| Hook                   | Description                       |
|------------------------|-----------------------------------|
| `useRazorpayCustomerTokens` | List customer tokens          |
| `useRazorpayCustomerToken`   | Fetch a single token         |
| `useAddBankAccount`          | Add bank account (mutation)  |
| `useDeleteBankAccount`       | Delete bank account (mutation) |
| `useDeleteToken`             | Delete a token (mutation)     |

### Add-on Hooks

| Hook            | Description                 |
|-----------------|-----------------------------|
| `useRazorpayAddonList` | List all add-ons       |
| `useRazorpayAddon`      | Fetch a single add-on  |
| `useDeleteAddon`        | Delete an add-on (mutation) |

### Item Hooks

| Hook          | Description                |
|---------------|----------------------------|
| `useRazorpayItemList` | List all items        |
| `useRazorpayItem`      | Fetch a single item   |
| `useCreateItem`        | Create an item (mutation) |
| `useEditItem`          | Edit an item (mutation)  |
| `useDeleteItem`        | Delete an item (mutation) |

### Query Keys

All hooks use structured query keys for cache invalidation:

```ts
export const razorpayQueryKeys = {
  all: ["razorpay"],
  subscriptions: () => [...all, "subscriptions"],
  subscriptionList: (referenceId?, customerType?) => [...],
  subscription: (subscriptionId) => [...],
  razorpaySubscription: (subscriptionId) => [...],
  allSubscriptions: (query?) => [...],
  invoices: (subscriptionId) => [...],
  pendingUpdate: (subscriptionId) => [...],
  plans: () => [...],
  plan: (planId) => [...],
  payments: () => [...],
  payment: (paymentId) => [...],
  refunds: () => [...],
  refund: (refundId) => [...],
  orders: () => [...],
  invoice: (invoiceId) => [...],
  addons: () => [...],
  addon: (addonId) => [...],
  items: () => [...],
  item: (itemId) => [...],
  customers: () => [...],
  customer: (customerId) => [...],
  tokens: (customerId) => [...],
  bankAccounts: (customerId) => [...],
};
```

---

## Types

### `Subscription`

Represents a subscription stored in the Better Auth database, synchronized with Razorpay.

```ts
interface Subscription {
  id: string;          // Database identifier
  plan: string;        // Plan name (matches `RazorpayPlan.name`)
  status: RazorpaySubscriptionStatus;
  razorpayCustomerId?: string;
  razorpaySubscriptionId?: string;
  razorpayPlanId?: string;
  referenceId: string;  // userId or organizationId
  currentStart?: Date;
  currentEnd?: Date;
  endedAt?: Date;
  quantity?: number;
  totalCount?: number;
  paidCount?: number;
  remainingCount?: number;
  cancelledAt?: Date;
  pausedAt?: Date;
  shortUrl?: string;
  cancelAtCycleEnd?: boolean;
  groupId?: string;
  billingPeriod?: string;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: string;    // JSON string
  renewedAt?: Date;
}
```

### Subscription Status Helpers

```ts
const {
  isActive,           // status === "active"
  isAuthenticated,    // status === "authenticated"
  isPaused,           // status === "paused"
  isCancelled,        // status === "cancelled"
  isCompleted,        // status === "completed"
  isExpired,          // status === "expired"
  isHalted,           // status === "halted"
  isPending,          // status === "pending"
  isUsable,           // isActive || isAuthenticated
  isTerminal,         // isCancelled || isCompleted || isExpired
  hasPaymentIssue,    // isPending || isHalted
  canRestore,         // cancelAtCycleEnd === true && isActive
} = useSubscriptionStatus(subscription);
```

### `RazorpayOptions`

```ts
interface RazorpayOptions {
  razorpayClient?: InstanceType<typeof Razorpay>;
  keyId?: string;
  keySecret?: string;
  defaultCurrency?: string;        // default: "INR"
  requireSession?: boolean;        // default: true
  razorpayWebhookSecret?: string;
  createCustomerOnSignUp?: boolean;
  onCustomerCreate?: (...) => Promise<void>;
  getCustomerCreateParams?: (...) => Promise<Record<string, unknown>>;
  subscription?: {
    enabled: true;
    plans: RazorpayPlan[];
    requireEmailVerification?: boolean;
    // ... lifecycle callbacks
  };
  organization?: {
    enabled: true;
    getCustomerCreateParams?: (...) => Promise<Record<string, unknown>>;
    onCustomerCreate?: (...) => Promise<void>;
  };
  onEvent?: (event: RazorpayWebhookEvent) => Promise<void>;
  onPaymentAuthorized?: ({ event, payment }) => Promise<void>;
  onPaymentCaptured?: (...) => Promise<void>;
  // ... all webhook callbacks
}
```

---

## Error Codes

All error codes are available under `RAZORPAY_ERROR_CODES` and used by `createAPIError` under the `BAD_REQUEST` / `INTERNAL_SERVER_ERROR` / `NOT_FOUND` status codes:

```ts
import { RAZORPAY_ERROR_CODES } from "@amank-root/better-auth-razorpay";

console.log(RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND);
// "Subscription not found"
```

Full list (78 error codes covering subscriptions, refunds, invoices, orders, payments, customers, bank accounts, tokens, add-ons, items, offers, and more).

---

## Testing

```bash
npm test
```

The test suite uses [Vitest](https://vitest.dev) and covers:
- Razorpay serializers (orders, payments, refunds)
- Order input mapping (`toRazorpayOrderInput`)
- Webhook handlers (all 10 new webhook events)
- Schema validation
- Signature verification
- Error code structure and count
- Utility functions (status checks, trial helpers)

---

## Development

```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Run tests
bun run test

# Build for npm
bun run build

# Publish (builds automatically via prepublishOnly)
npm publish
```

### Project Structure

```
src/
  index.ts          # Plugin definition and endpoint registration
  routes.ts         # All Better Auth endpoint definitions
  client.ts         # Client plugin (path methods for typed calls)
  react.ts          # React Query hooks + query keys
  types.ts          # Type definitions
  error-codes.ts    # Error code constants
  razorpay.ts       # Serializers and input mappers
  hooks.ts          # Webhook event handlers
  schema.ts         # Database schema
  signature.ts      # Payment signature verification
  utils.ts          # Utility functions
  version.ts        # Version constant
```

---

## License

MIT
