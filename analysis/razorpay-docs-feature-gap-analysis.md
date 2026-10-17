# Razorpay llms.txt — Feature Gap Analysis for better-auth-razorpay Plugin

**Date:** 2026-10-17  
**Source:** `https://razorpay.com/docs/llms.txt` (parsed)  
**SDK:** `razorpay` npm package — inspected `node_modules/razorpay/dist/types/*.d.ts`  
**Plugin:** `better-auth-razorpay` v0.1.0 — inspected all 15 `src/*.ts` files  
**Webhook events reference:** `webhooks/all.md`, `webhooks/payments.md`, `webhooks/refunds.md`, `webhooks/invoices.md`, `webhooks/orders.md`

---

## 1. Current Plugin Coverage (as of v0.1.0)

### Already Implemented

| Resource | Plugin Endpoint(s) | SDK Method(s) | Status |
|---|---|---|---|
| **Orders** | POST `/razorpay/create-order`, GET `/razorpay/order` | `client.orders.create()`, `client.orders.fetch()` | Done |
| **Payments** | GET `/razorpay/payment`, POST `/razorpay/payment/capture`, POST `/razorpay/payment/refund` | `client.payments.fetch()`, `client.payments.capture()`, `client.payments.refund()` | Done |
| **Signature Verification** | Exported helpers for payment + webhook signatures | `createHmac` / `timingSafeEqual` | Done |
| **Subscriptions** | 8 endpoints (upgrade, cancel, pause, resume, list, update, restore, get) + 6 Razorpay-specific endpoints (fetch, link, pending-update, cancel-update, invoices, link-offer, delete-offer) | `client.subscriptions.create()`, `.cancel()`, `.pause()`, `.resume()`, `.update()`, `.pendingUpdate()`, `.cancelScheduledChanges()`, `.deleteOffer()`; `client.invoices.all({subscription_id})` | Done |
| **Plans** | POST `/razorpay/plan/create`, GET `/razorpay/plan/list`, GET `/razorpay/plan/get` | `client.plans.create()`, `client.plans.all()`, `client.plans.fetch()` | Done |
| **Customers** | POST `/razorpay/customer/create`, POST `/razorpay/customer/edit`, GET `/razorpay/customer/list`, GET `/razorpay/customer/get` | `client.customers.create()`, `.edit()`, `.all()`, `.fetch()` | Done |
| **Invoices (subscription-linked)** | GET `/razorpay/subscription/invoices` | `client.invoices.all({subscription_id})` | Partial (subscription-only) |
| **Webhooks Handler** | POST `/razorpay/webhook` (HMAC-SHA256 verification) | Custom switch-case dispatch | Done (subscription events only) |
| **DB Schema** | `subscription`, `user.razorpayCustomerId`, `organization.razorpayCustomerId` | — | Done |
| **Client (React)** | `client.ts` + `react.ts` (TanStack Query hooks) | — | Done |
| **Organization Sync** | Database hooks for name sync, seat quantity sync, deletion guard | — | Done |

### Webhook Events Currently Handled (10 out of ~50+ total)

- `subscription.authenticated` — Done
- `subscription.activated` — Done
- `subscription.charged` — Done
- `subscription.pending` — Done
- `subscription.halted` — Done
- `subscription.completed` — Done
- `subscription.updated` — Done
- `subscription.paused` — Done
- `subscription.resumed` — Done
- `subscription.cancelled` — Done
- All other event types fall through to the default `logger.info` branch.

---

## 2. Feature Gap Analysis

### 2.1 Orders API (SDK: `client.orders`)

**SDK methods available:** `create`, `all`, `fetch`, `edit`, `fetchPayments`, `fetchTransferOrder`, `viewRtoReview`, `editFulfillment`

**Plugin currently has:** `create`, `fetch`

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| Update order notes | `client.orders.edit(orderId, { notes })` | `api/orders/update.md` | Medium | Update notes on an existing order. Low complexity. |
| Fetch all orders | `client.orders.all(query)` | `api/orders/fetch-all.md` | Medium | List orders with pagination, receipt filter, expand flags. |
| Fetch payments for an order | `client.orders.fetchPayments(orderId)` | `api/orders/fetch-payments.md` | Low | Returns all payments associated with an order. |
| Fetch order with expanded card payments | (via `expand[]` query param) | `api/orders/fetch-all-expanded-card-payments.md` | Low | Advanced filtering. |
| RTO risk review | `client.orders.viewRtoReview(orderId)` | `payments/magic-checkout/rto-intelligence.md` | Low | Magic Checkout RTO risk prediction. Niche. |

### 2.2 Payments API (SDK: `client.payments`)

**SDK methods available:** `all`, `fetch`, `capture`, `refund`, `edit` (+ `createPaymentJson` for S2S)

**Plugin currently has:** `fetch`, `capture`, `refund`

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| Fetch all payments | `client.payments.all(query)` | `api/payments/fetch-all-payments.md` | High | Bulk payment listing with pagination, expand options. |
| Update payment notes | `client.payments.edit(paymentId, { notes })` | `api/payments/update.md` | Low | Only updates notes field. |
| Fetch payment with expanded details | `client.payments.fetch(paymentId, { expand })` | `api/payments/fetch-payment-expanded-card.md` | Medium-Low | Expand card, EMI, or offer details. |
| Server-to-server payment creation | `client.payments.createPaymentJson(params)` | `api/payments/form-post-payment-create.md` | Low | Requires additional security setup. |

### 2.3 Refunds API (SDK: `client.refunds`)

**SDK methods available:** `all`, `fetch`, `edit`

**Plugin currently has:** refund creation via `client.payments.refund()` only

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| Fetch all refunds | `client.refunds.all(query)` | `api/refunds/fetch-all.md` | Medium | List refunds with pagination. |
| Fetch a specific refund | `client.refunds.fetch(refundId, { payment_id })` | `api/refunds/fetch-with-id.md` | High | Fetch refund details by ID. |
| Fetch multiple refunds for a payment | (part of `fetch` with `payment_id` filter) | `api/refunds/fetch-multiple-refund-payment.md` | Medium | List all refunds on a specific payment. |
| Update refund notes | `client.refunds.edit(refundId, { notes })` | `api/refunds/update.md` | Low | Update notes on an existing refund. |
| Fetch specific refund for a payment | `client.refunds.fetch(refundId, { payment_id })` | `api/refunds/fetch-specific-refund-payment.md` | Medium | Fetch a specific refund associated with a payment. |

### 2.4 Customers API (SDK: `client.customers`)

**SDK methods available:** `create`, `all`, `fetch`, `edit`, `fetchTokens`, `fetchToken`, `deleteToken`, `addBankAccount`, `deleteBankAccount`, `requestEligibilityCheck`, `fetchEligibility`

**Plugin currently has:** `create`, `edit`, `all`, `fetch`

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| Add bank account to customer | `client.customers.addBankAccount(customerId, params)` | `api/customers/bank-accounts.md` | Medium | Requires verification workflow. |
| Delete bank account from customer | `client.customers.deleteBankAccount(customerId, bankAccountId)` | `api/customers/bank-accounts.md` | Low | |
| Fetch customer tokens | `client.customers.fetchTokens(customerId)` | `api/customers.md` (token section) | Low | List saved payment tokens. |
| Fetch a specific token | `client.customers.fetchToken(customerId, tokenId)` | `api/customers.md` (token section) | Low | |
| Delete a customer token | `client.customers.deleteToken(customerId, tokenId)` | `api/customers.md` (token section) | Low | |
| Customer eligibility check | `client.customers.requestEligibilityCheck(param)` | `payments/optimizer/eligibility-check.md` | Low | Affordability/EMI eligibility. |
| Fetch eligibility by ID | `client.customers.fetchEligibility(eligibilityId)` | `payments/optimizer/eligibility-check.md` | Low | |

### 2.5 Subscriptions API (SDK: `client.subscriptions`)

**SDK methods available:** `create`, `all`, `fetch`, `update`, `pendingUpdate`, `cancelScheduledChanges`, `pause`, `resume`, `cancel`, `deleteOffer`, `createAddon`, `createRegistrationLink`

**Plugin currently has:** `create`, `fetch`, `update`, `pendingUpdate`, `cancelScheduledChanges`, `pause`, `resume`, `cancel`, `deleteOffer` (plus `createRegistrationLink` via `createSubscriptionLink`)

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| Fetch all subscriptions | `client.subscriptions.all(query)` | `api/payments/subscriptions/fetch-all-subscriptions.md` | Medium | List subscriptions with pagination/filter by plan_id. Currently only local DB `listSubscriptions` exists. |
| Create add-on for subscription | `client.subscriptions.createAddon(subId, params)` | `api/payments/subscriptions/create-add-on.md` | Medium | Add-ons are partially supported (line items in upgrade), but no standalone add-on management endpoint. |
| **Add-on management (standalone):** | | | | |
| Fetch a specific add-on | `client.addons.fetch(addonId)` | (via `addons.d.ts`) | Low | SDK `addons` module exists but is not exposed on `client`. |
| List all add-ons | `client.addons.all(query)` | | Low | |
| Delete an add-on | `client.addons.delete(addonId)` | | Low | |

### 2.6 Plans API (SDK: `client.plans`)

**SDK methods available:** `create`, `all`, `fetch`

**Plugin currently has:** All three.

**No gaps.**

### 2.7 Invoices API (SDK: `client.invoices`)

**SDK methods available:** `create`, `all`, `fetch`, `edit`, `issue`, `delete`, `cancel`, `notifyBy`

**Plugin currently has:** `all` (only with `subscription_id` filter)

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| Create a standalone invoice | `client.invoices.create(params)` | `api/payments/invoices/create-invoice.md` | High | Full invoice creation with line items, customer details, etc. |
| Fetch a single invoice | `client.invoices.fetch(invoiceId)` | `api/payments/invoices.md` | High | Currently only subscription-scoped invoice listing exists. |
| Update an invoice | `client.invoices.edit(invoiceId, params)` | `api/payments/invoices/update.md` | Medium | Partial updates to draft invoices. |
| Cancel an invoice | `client.invoices.cancel(invoiceId)` | `payments/invoices/cancel.md` | Medium | |
| Delete an invoice | `client.invoices.delete(invoiceId)` | `payments/invoices/delete.md` | Low | Only draft invoices can be deleted. |
| Issue an invoice | `client.invoices.issue(invoiceId)` | `payments/invoices/issue.md` | Medium | Moves draft invoice to issued state. |
| Send notification | `client.invoices.notifyBy(invoiceId, medium)` | (via `INotify` type) | Low | Send SMS/email notifications. |
| Fetch invoices by payment_id | `client.invoices.all({ payment_id })` | `api/payments/invoices/fetch-invoices.md` | Medium | Filter invoices by payment. |
| Fetch invoices by receipt | `client.invoices.all({ receipt })` | | Low | |

### 2.8 Refunds — Full Refund Lifecycle (SDK: `client.refunds`)

The plugin currently only initiates refunds via `client.payments.refund()`. The standalone Refunds API has:

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| All refunds listing | `client.refunds.all()` | `api/refunds/fetch-all.md` | Medium | |
| Fetch refund by ID | `client.refunds.fetch(refundId)` | `api/refunds/fetch-with-id.md` | High | |
| Update refund notes | `client.refunds.edit(refundId, { notes })` | `api/refunds/update.md` | Low | |

### 2.9 Items API (SDK: `client.items`)

**SDK methods available:** `create`, `all`, `fetch`, `edit`, `delete`

**Plugin currently has:** None

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| Create an item | `client.items.create(params)` | `api/payments/invoices/create-item.md` | Low | Items are used as line items in invoices. |
| List items | `client.items.all(query)` | | Low | |
| Fetch item | `client.items.fetch(itemId)` | | Low | |
| Edit item | `client.items.edit(itemId, params)` | | Low | |
| Delete item | `client.items.delete(itemId)` | | Low | |

### 2.10 Webhooks — Event Coverage Gaps

The current webhook handler (`routes.ts` switch statement) only handles `subscription.*` events. The full list of webhook events from `webhooks/all.md` that are **not** handled:

#### Payment Events (not handled)
| Event | Description | Docs URL | Priority |
|---|---|---|---|
| `payment.authorized` | Payment authorized | `webhooks/payments.md` | High |
| `payment.captured` | Payment captured | `webhooks/payments.md` | High |
| `payment.failed` | Payment failed | `webhooks/payments.md` | High |
| `payment.downtime.started` | Payment method downtime started | `webhooks/payments.md` | Low |
| `payment.downtime.resolved` | Payment method downtime resolved | `webhooks/payments.md` | Low |
| `payment.downtime.updated` | Payment method downtime updated | `webhooks/payments.md` | Low |

#### Order Events (not handled)
| Event | Description | Docs URL | Priority |
|---|---|---|---|
| `order.paid` | Order successfully paid | `webhooks/orders.md` | High |

#### Invoice Events (not handled)
| Event | Description | Docs URL | Priority |
|---|---|---|---|
| `invoice.partially_paid` | Partial payment on invoice | `webhooks/invoices.md` | Medium |
| `invoice.paid` | Invoice fully paid | `webhooks/invoices.md` | Medium |
| `invoice.expired` | Invoice expired | `webhooks/invoices.md` | Medium |

#### Refund Events (not handled)
| Event | Description | Docs URL | Priority |
|---|---|---|---|
| `refund.created` | Refund created | `webhooks/refunds.md` | High |
| `refund.processed` | Refund successfully processed | `webhooks/refunds.md` | High |
| `refund.failed` | Refund processing failed | `webhooks/refunds.md` | High |
| `refund.speed_changed` | Refund speed changed | `webhooks/refunds.md` | Low |

#### Dispute Events (not handled)
| Event | Description | Docs URL | Priority |
|---|---|---|---|
| `payment.dispute.created` | Dispute raised | `webhooks/disputes.md` | Medium |
| `payment.dispute.won` | Dispute won | `webhooks/disputes.md` | Medium |
| `payment.dispute.lost` | Dispute lost | `webhooks/disputes.md` | Medium |
| `payment.dispute.closed` | Dispute closed | `webhooks/disputes.md` | Low |
| `payment.dispute.under_review` | Dispute under review | `webhooks/disputes.md` | Low |
| `payment.dispute.action_required` | Evidence update needed | `webhooks/disputes.md` | Low |

#### Other Events (not handled)
| Category | Event | Priority | Notes |
|---|---|---|---|
| Settlements | `settlement.processed`, `settlement.processed` | Low | |
| Transfers | `transfer.processed`, `transfer.failed` | Low | Route/split payments |
| QR Codes | `qr_code.created`, `qr_code.credited`, `qr_code.closed` | Low | |
| Virtual Accounts | `virtual_account.created`, `virtual_account.credited`, `virtual_account.closed` | Low | |
| Payment Links | `payment_link.paid`, `payment_link.partially_paid`, `payment_link.cancelled`, `payment_link.expired` | Low | |
| Payouts | `payout.pending`, `payout.rejected`, `payout.queued`, `payout.initiated`, `payout.failed`, `payout.resolved` | Low | RazorpayX |
| Payout Downtime | `payout.downtime.started`, `payout.downtime.resolved` | Low | |
| Fund Account Validation | `fund_account.validation.completed`, `fund_account.validation.failed` | Low | |
| Payout Links | `payout_link.pending`, `payout_link.issued`, `payout_link.processing`, `payout_link.processed`, `payout_link.attempted`, `payout_link.cancelled`, `payout_link.rejected`, `payout_link.expired` | Low | |
| Transactions | `transaction.created` | Low | |
| Partners | `account.app.authorization_revoked` | Low | |

### 2.11 Customer Fund Accounts (SDK: part of `client.customers` / `FundAccounts`)

The SDK has a `FundAccounts` module but it's primarily used internally by the Orders and Customers types. The docs reference `api/customers/customer-fund-account.md`.

| Gap | SDK Method | Docs URL | Priority | Notes |
|---|---|---|---|---|
| Customer fund account operations | Various | `api/customers/customer-fund-account.md` | Low | Bank account / UPI / card fund accounts for customers. |

### 2.12 Disputes API (SDK: `client.disputes`)

**SDK methods available:** (check `disputes.d.ts`) — likely `all`, `fetch`, `accept`, `contest`

| Gap | Docs URL | Priority | Notes |
|---|---|---|---|
| Dispute management | `api/disputes.md` | Low | Disputes API for accepting/contesting disputes. |

### 2.13 Products API (SDK: `client.products`)

**SDK methods available:** `requestProductConfiguration`, `fetch`, `edit`, `fetchTnc`

| Gap | Docs URL | Priority | Notes |
|---|---|---|---|
| Product configuration | `api/partners/product-configuration.md` | Low | Primarily for partners/sub-merchants. Requires `accountId`. |

---

## 3. SDK Module Availability Check

Not all SDK modules are attached to the `Razorpay` client instance. Here's the status:

| SDK Module | Attached to `client`? | Plugin Uses It? |
|---|---|---|
| `orders` | Yes | Yes |
| `payments` | Yes | Yes |
| `customers` | Yes | Yes (via `client.customers`) |
| `subscriptions` | Yes | Yes (via `client.subscriptions`) |
| `plans` | Yes | Yes (via `client.plans`) |
| `invoices` | Yes | Yes (via `client.invoices` in fetchInvoices) |
| `refunds` | Yes | No |
| `items` | Yes | No |
| `addons` | Yes | No (standalone module exists) |
| `webhooks` | Yes | No (partner-focused, needs accountId) |
| `products` | Yes | No (partner-focused, needs accountId) |
| `cards` | Yes | No |
| `disputes` | Yes | No |
| `documents` | Yes | No |
| `fundAccount` | Yes | No |
| `virtualAccounts` | Yes | No |
| `transfers` | Yes | No |
| `qrCode` | Yes | No |
| `settlements` | Yes | No |
| `stakeholders` | Yes | No |

---

## 4. Priority Recommendations (Top 10)

These are the highest-impact, lowest-effort additions, sorted by priority:

### P0 — Critical Gaps (High Impact, Easy Implementation)

1. **`fetchAllPayments` endpoint** — `client.payments.all()` with pagination query. Missing the most common "list payments" operation.
2. **Standalone `fetchRefund` endpoint** — `client.refunds.fetch(refundId)` to look up a specific refund by ID.
3. **`fetchAllRefunds` endpoint** — `client.refunds.all()` to list all refunds.
4. **Full Webhooks expansion** — Add handlers for `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`, `invoice.paid`, `invoice.partially_paid`, `invoice.expired`. Wire each to an `onEvent` callback option.
5. **Standalone Invoice CRUD** — `client.invoices.create()`, `.fetch(invoiceId)`, `.cancel(invoiceId)`, `.issue(invoiceId)` — invoices are currently only listable via subscription.

### P1 — High Value (Medium Effort)

6. **Subscriptions: `fetchAllSubscriptions`** — `client.subscriptions.all({ plan_id, count, skip })` to list directly from Razorpay, distinct from the local DB `listSubscriptions`.
7. **Orders: `editOrder`** — `client.orders.edit(orderId, { notes })` for updating order notes.
8. **Orders: `fetchPaymentsForOrder`** — `client.orders.fetchPayments(orderId)` to list payments against an order.

### P2 — Medium Value

9. **Customers: `addBankAccount` / `deleteBankAccount`** — `client.customers.addBankAccount(customerId, params)`.
10. **Subscriptions: `createAddon`** — `client.subscriptions.createAddon(subscriptionId, params)` as a direct API.
11. **Subscriptions: `updateSubscriptionNotes`** callback — add `onSubscriptionUpdated` to also handle add-on lifecycle.

### P3 — Low Priority / Niche

12. Payment Links API — create, update, cancel, fetch payment links (`client.paymentLink`).
13. QR Codes API — create, fetch, close QR codes (`client.qrCode`).
14. Disputes API — accept/contest disputes (`client.disputes`).
15. Items API — create, list, fetch, edit items (`client.items`).
16. Cards API — fetch card details (`client.cards`).
17. Settlements API — fetch settlement details (`client.settlements`).
18. Documents API — upload/fetch documents (`client.documents`).
19. Smart Collect / Virtual Accounts — create/fetch/close virtual accounts (`client.virtualAccounts`, `client.fundAccount`).
20. Route (split payments) — create transfers, fetch transfers (`client.transfers`).
21. Webhook management API (self-service webhook CRUD) — `client.webhooks.create/fetch/all/edit/delete`.
22. Product configuration (partner) — `client.products`.

---

## 5. SDK Method Mapping (Current vs Available)

### Orders
```
SDK has:         create ✓  all ✗  fetch ✓  edit ✗  fetchPayments ✗  fetchTransferOrder ✗  viewRtoReview ✗  editFulfillment ✗
Plugin has:      create ✓  fetch ✓
```

### Payments
```
SDK has:         all ✗  fetch ✓  capture ✓  refund ✓  edit ✗  createPaymentJson ✗
Plugin has:      fetch ✓  capture ✓  refund ✓
```

### Refunds
```
SDK has:         all ✗  fetch ✗  edit ✗
Plugin has:      (none — refund creation only via payments.refund)
```

### Customers
```
SDK has:         create ✓  all ✓  fetch ✓  edit ✓  fetchTokens ✗  fetchToken ✗  deleteToken ✗  addBankAccount ✗  deleteBankAccount ✗  requestEligibilityCheck ✗  fetchEligibility ✗
Plugin has:      create ✓  all ✓  fetch ✓  edit ✓
```

### Subscriptions
```
SDK has:         create ✓  all ✗  fetch ✓  update ✓  pendingUpdate ✓  cancelScheduledChanges ✓  pause ✓  resume ✓  cancel ✓  deleteOffer ✓  createAddon ✗  createRegistrationLink ✓
Plugin has:      create ✓  fetch ✓  update ✓  pendingUpdate ✓  cancelScheduledChanges ✓  pause ✓  resume ✓  cancel ✓  deleteOffer ✓  createRegistrationLink ✓
```

### Invoices
```
SDK has:         create ✗  all ✓(sub-only)  fetch ✗  edit ✗  issue ✗  delete ✗  cancel ✗  notifyBy ✗
Plugin has:      all (subscription_id filter only)
```

### Plans
```
SDK has:         create ✓  all ✓  fetch ✓
Plugin has:      create ✓  all ✓  fetch ✓
```

### Add-ons (standalone)
```
SDK has:         fetch ✗  all ✗  delete ✗
Plugin has:      (none — only via subscriptions.createAddon)
```

### Items
```
SDK has:         create ✗  all ✗  fetch ✗  edit ✗  delete ✗
Plugin has:      (none)
```

### Webhooks Management
```
SDK has:         create ✗  fetch ✗  all ✗  edit ✗  delete ✗  (requires accountId — partner-focused)
Plugin has:      (none — webhook handling only, not management)
```

---

## 6. Webhook Event Coverage

**Currently handled (10):**
- `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.completed`, `subscription.updated`, `subscription.paused`, `subscription.resumed`, `subscription.cancelled`

**Not handled — should be (11 high/medium priority):**
- `payment.authorized`, `payment.captured`, `payment.failed`
- `order.paid`
- `refund.created`, `refund.processed`, `refund.failed`
- `invoice.partially_paid`, `invoice.paid`, `invoice.expired`

**Not handled — low priority (30+):**
- `payment.downtime.*`, `payment.dispute.*`, `settlement.*`, `transfer.*`, `qr_code.*`, `virtual_account.*`, `payment_link.*`, `payout.*`, `payout_link.*`, `transaction.created`, `account.app.authorization_revoked`

---

## 7. Recommended Implementation Order

1. **Webhook event expansion** — extend the `switch` in `routes.ts` to handle payment, order, invoice, and refund events. Add `onPaymentCaptured`, `onPaymentFailed`, `onRefundProcessed`, etc. callbacks to `RazorpayOptions`.
2. **`fetchAllPayments` endpoint** — `client.payments.all()` with pagination query params.
3. **Standalone refund endpoints** — `fetchRefund`, `fetchAllRefunds` via `client.refunds`.
4. **Full invoice CRUD** — `createInvoice`, `fetchInvoice`, `cancelInvoice`, `issueInvoice`, `deleteInvoice`, `editInvoice` via `client.invoices`.
5. **Subscriptions: `fetchAllSubscriptions`** — `client.subscriptions.all()`.
6. **Orders: `editOrder`, `fetchPaymentsForOrder`**.
7. **Customers: `addBankAccount`, `deleteBankAccount`, token management endpoints**.
8. **Subscriptions: `createAddon` + add-on fetch/delete**.
9. **Items API endpoints** — `createItem`, `fetchItem`, `listItems`, `editItem`, `deleteItem`.
10. **Payment Links API** — if payment link support is desired.
