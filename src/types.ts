import type {
    GenericEndpointContext,
    InferOptionSchema,
    Session,
    User,
} from "better-auth";
import type { Organization } from "better-auth/plugins/organization";
import type Razorpay from "razorpay";
import type { organization, subscriptions, user } from "./schema";

export type AuthorizeReferenceAction =
  | "upgrade-subscription"
  | "list-subscription"
  | "cancel-subscription"
  | "pause-subscription"
  | "resume-subscription"
  | "update-subscription"
  | "restore-subscription"
  | "get-subscription";

export type CustomerType = "user" | "organization";

export type WithRazorpayCustomerId = {
  razorpayCustomerId?: string;
};

// TODO: Types extended by a plugin should be moved into that plugin.
export type WithActiveOrganizationId = {
  activeOrganizationId?: string;
};

export type RazorpayCtxSession = {
  session: Session & WithActiveOrganizationId;
  user: User & WithRazorpayCustomerId;
};

/**
 * Razorpay subscription status lifecycle.
 *
 * @see https://razorpay.com/docs/payments/subscriptions/states/
 */
export type RazorpaySubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused";

export type RazorpayPlan = {
  /**
   * Razorpay Plan ID (e.g., plan_00000000000001)
   */
  planId: string;
  /**
   * Annual/discount plan ID for yearly billing
   */
  annualPlanId?: string | undefined;
  /**
   * Plan name
   */
  name: string;
  /**
   * Limits for the plan
   *
   * useful when you want to define plan-specific metadata.
   */
  limits?: Record<string, unknown> | undefined;
  /**
   * Plan group name
   *
   * useful when you want to group plans or
   * when a user can subscribe to multiple plans.
   */
  group?: string | undefined;
  /**
   * Number of billing cycles (total_count) for the subscription.
   * If not set, defaults will be used.
   */
  totalCount?: number | undefined;
  /**
   * Quantity for seat-based billing.
   * This is the number of times the plan amount
   * is charged per invoice.
   *
   * Requires the `organization` plugin. Member changes
   * automatically sync the seat quantity.
   */
  quantity?: number | undefined;
  /**
   * Free trial configuration
   */
  freeTrial?:
    | {
        /**
         * Number of days for the free trial.
         * Maps to Razorpay's `start_at` offset.
         */
        days: number;
        /**
         * A function that will be called when the trial starts.
         */
        onTrialStart?: (subscription: Subscription) => Promise<void>;
        /**
         * A function that will be called when the trial
         * ends (subscription goes active).
         */
        onTrialEnd?: (
          data: {
            subscription: Subscription;
          },
          ctx: GenericEndpointContext,
        ) => Promise<void>;
        /**
         * A function that will be called when the trial expires
         * without converting to a paid subscription.
         */
        onTrialExpired?: (
          subscription: Subscription,
          ctx: GenericEndpointContext,
        ) => Promise<void>;
      }
    | undefined;
};

export interface Subscription {
  /**
   * Database identifier
   */
  id: string;
  /**
   * The plan name
   */
  plan: string;
  /**
   * Razorpay customer id
   */
  razorpayCustomerId?: string | undefined;
  /**
   * Razorpay subscription id
   */
  razorpaySubscriptionId?: string | undefined;
  /**
   * Razorpay plan id
   */
  razorpayPlanId?: string | undefined;
  /**
   * To what reference id the subscription belongs to
   * @example
   * - userId for a user
   * - workspace id for a saas platform
   * - website id for a hosting platform
   *
   * @default - userId
   */
  referenceId: string;
  /**
   * Subscription status
   */
  status: RazorpaySubscriptionStatus;
  /**
   * The current billing cycle start date (Unix timestamp)
   */
  currentStart?: Date | undefined;
  /**
   * The current billing cycle end date (Unix timestamp)
   */
  currentEnd?: Date | undefined;
  /**
   * When the subscription ended (cancelled/completed)
   */
  endedAt?: Date | undefined;
  /**
   * Number of seats/quantity
   */
  quantity?: number | undefined;
  /**
   * Total number of billing cycles
   */
  totalCount?: number | undefined;
  /**
   * Number of billing cycles already charged
   */
  paidCount?: number | undefined;
  /**
   * Remaining billing cycles
   */
  remainingCount?: number | undefined;
  /**
   * When the subscription was cancelled
   */
  cancelledAt?: Date | undefined;
  /**
   * When the subscription was paused
   */
  pausedAt?: Date | undefined;
  /**
   * Short URL for payment authorization
   */
  shortUrl?: string | undefined;
  /**
   * Whether cancellation is scheduled at cycle end
   */
  cancelAtCycleEnd?: boolean | undefined;
  /**
   * A field to group subscriptions so you can have multiple subscriptions
   * for one reference id
   */
  groupId?: string | undefined;
  /**
   * The billing period (daily, weekly, monthly, quarterly, yearly)
   */
  billingPeriod?: string | undefined;
  /**
   * When the free trial started
   */
  trialStart?: Date | undefined;
  /**
   * When the free trial ends (or ended)
   */
  trialEnd?: Date | undefined;
  /**
   * Custom metadata stored as JSON string.
   * Use `JSON.parse()` to read and `JSON.stringify()` to write.
   */
  metadata?: string | undefined;
  /**
   * Last renewal date (set when a recurring charge succeeds after the first)
   */
  renewedAt?: Date | undefined;
}

/**
 * Razorpay webhook event payload structure
 */
export interface RazorpayWebhookEvent {
  entity: "event";
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    subscription?: {
      entity: RazorpaySubscriptionEntity;
    };
    payment?: {
      entity: RazorpayPaymentEntity;
    };
    refund?: {
      entity: RazorpayRefundEntity;
    };
    invoice?: {
      entity: RazorpayInvoiceEntity;
    };
    order?: {
      entity: RazorpayOrderEntity;
    };
    dispute?: {
      entity: RazorpayDisputeEntity;
    };
  };
  created_at: number;
}

/**
 * Razorpay Payment entity (from webhooks / payments API)
 */
export interface RazorpayPaymentEntity {
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
  [key: string]: unknown;
}

/**
 * Razorpay Refund entity (from refunds API and webhooks)
 */
export interface RazorpayRefundEntity {
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
  [key: string]: unknown;
}

/**
 * Razorpay Invoice entity (from invoices API and webhooks)
 */
export interface RazorpayInvoiceEntity {
  id: string;
  entity: string;
  invoice_number: string;
  customer_details?: Record<string, unknown> | null;
  line_items?: Record<string, unknown>[];
  payment_id?: string | null;
  issued_at?: number | null;
  paid_at?: number | null;
  cancelled_at?: number | null;
  expired_at?: number | null;
  sms_status?: "pending" | "sent" | null;
  email_status?: "pending" | "sent" | null;
  gross_amount?: number;
  tax_amount?: number;
  taxable_amount?: number;
  status?:
    | "draft"
    | "issued"
    | "partially_paid"
    | "paid"
    | "cancelled"
    | "expired"
    | "deleted";
  amount_paid?: number;
  amount_due?: number;
  short_url?: string | null;
  currency_symbol?: string | null;
  created_at: number;
  [key: string]: unknown;
}

/**
 * Razorpay Order entity (from orders API and webhooks)
 */
export interface RazorpayOrderEntity {
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
  [key: string]: unknown;
}

/**
 * Razorpay Dispute entity (from webhooks)
 */
export interface RazorpayDisputeEntity {
  id: string;
  entity: string;
  payment_id: string;
  payment_order_id: string;
  amount: number;
  currency: string;
  amount_due: number;
  status: string;
  [key: string]: unknown;
}

/**
 * Razorpay Item entity (from items API)
 */
export interface RazorpayItemEntity {
  id: string;
  entity: string;
  name: string;
  amount: number | string;
  currency: string;
  description?: string | null;
  unit_amount: number;
  type: string;
  unit: number | null;
  tax_inclusive: boolean;
  hsn_code: number | null;
  sac_code: number | null;
  tax_rate: number | null;
  tax_id: string | null;
  tax_group_id: string | null;
  created_at: number;
  updated_at: number;
  active: boolean;
  [key: string]: unknown;
}

/**
 * Razorpay Add-on entity (from add-ons API)
 */
export interface RazorpayAddonEntity {
  id: string;
  entity: string;
  item: RazorpayItemEntity;
  quantity: number;
  created_at: number;
  subscription_id: string;
  invoice_id: string;
  [key: string]: unknown;
}

/**
 * Razorpay Subscription response entity
 */
export interface RazorpaySubscriptionEntity {
  id: string;
  entity: "subscription";
  plan_id: string;
  customer_id?: string;
  status: RazorpaySubscriptionStatus;
  current_start: number | null;
  current_end: number | null;
  ended_at: number | null;
  quantity: number;
  notes: Record<string, string> | string[];
  charge_at: number | null;
  start_at: number;
  end_at: number;
  auth_attempts: number;
  total_count: number;
  paid_count: number;
  customer_notify: boolean;
  created_at: number;
  expire_by: number | null;
  short_url: string | null;
  has_scheduled_changes: boolean;
  change_scheduled_at: number | null;
  source: string;
  offer_id?: string;
  remaining_count: number;
  paused_at?: number;
  pause_initiated_by?: string | null;
  cancel_initiated_by?: string | null;
  payment_method?: string;
}

export type SubscriptionOptions = {
  /**
   * List of plans
   */
  plans: RazorpayPlan[] | (() => RazorpayPlan[] | Promise<RazorpayPlan[]>);
  /**
   * Require email verification before a user is allowed to upgrade
   * their subscriptions
   *
   * @default false
   */
  requireEmailVerification?: boolean | undefined;
  /**
   * A callback to run after a subscription is activated
   * (first payment success)
   */
  onSubscriptionActivated?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
        plan: RazorpayPlan;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run after a subscription is charged
   * (recurring payment success)
   */
  onSubscriptionCharged?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run after a subscription is authenticated
   */
  onSubscriptionAuthenticated?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run after a subscription is cancelled
   */
  onSubscriptionCancelled?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run after a subscription is paused
   */
  onSubscriptionPaused?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run after a subscription is resumed
   */
  onSubscriptionResumed?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run when a subscription payment is halted
   * (retries exhausted)
   */
  onSubscriptionHalted?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run when a subscription payment is pending
   * (retry in progress)
   */
  onSubscriptionPending?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run when a subscription is completed
   * (all billing cycles done)
   */
  onSubscriptionCompleted?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run when a subscription is updated
   * (plan change, quantity change)
   */
  onSubscriptionUpdated?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A callback to run when a subscription is renewed
   * (recurring charge after the first payment)
   */
  onSubscriptionRenewed?:
    | ((data: {
        event: RazorpayWebhookEvent;
        razorpaySubscription: RazorpaySubscriptionEntity;
        subscription: Subscription;
      }) => Promise<void>)
    | undefined;
  /**
   * A function to check if the reference id is valid
   * and belongs to the user
   */
  authorizeReference?:
    | ((
        data: {
          user: User & Record<string, any>;
          session: Session & Record<string, any>;
          referenceId: string;
          action: AuthorizeReferenceAction;
        },
        ctx: GenericEndpointContext,
      ) => Promise<boolean>)
    | undefined;
  /**
   * Custom parameters for Razorpay subscription creation
   */
  getSubscriptionCreateParams?:
    | ((
        data: {
          user: User & Record<string, any>;
          session: Session & Record<string, any>;
          plan: RazorpayPlan;
        },
        ctx: GenericEndpointContext,
      ) => Promise<Record<string, unknown>>)
    | undefined;
};

export interface RazorpayOptions {
  /**
   * Razorpay Client instance. If omitted, `keyId` and `keySecret` are used
   * to create one internally.
   */
  razorpayClient?: InstanceType<typeof Razorpay> | undefined;
  /**
   * Razorpay key id. Keep this server-side.
   */
  keyId?: string | undefined;
  /**
   * Razorpay key secret. Keep this server-side. Required for Checkout payment
   * signature verification when using the one-time payment endpoints.
   */
  keySecret?: string | undefined;
  /**
   * Default currency used when createOrder omits one.
   *
   * @default "INR"
   */
  defaultCurrency?: string | undefined;
  /**
   * Require a Better Auth session for payment/order provider endpoints.
   *
   * @default true
   */
  requireSession?: boolean | undefined;
  /**
   * Razorpay Webhook Secret
   *
   * @description Used for HMAC-SHA256 signature verification
   */
  razorpayWebhookSecret?: string | undefined;
  /**
   * Enable customer creation when a user signs up
   */
  createCustomerOnSignUp?: boolean | undefined;
  /**
   * A callback to run after a customer has been created
   */
  onCustomerCreate?:
    | ((
        data: {
          razorpayCustomer: {
            id: string;
            entity: string;
            name: string;
            email: string;
            contact: string;
          };
          user: User & WithRazorpayCustomerId;
        },
        ctx: GenericEndpointContext,
      ) => Promise<void>)
    | undefined;
  /**
   * Custom function to get customer create params
   */
  getCustomerCreateParams?:
    | ((
        user: User,
        ctx: GenericEndpointContext,
      ) => Promise<Record<string, unknown>>)
    | undefined;
  /**
   * Subscriptions
   */
  subscription?:
    | (
        | {
            enabled: false;
          }
        | ({
            enabled: true;
          } & SubscriptionOptions)
      )
    | undefined;
  /**
   * Organization Razorpay integration
   *
   * Enable organizations to have their own Razorpay customer ID
   */
  organization?:
    | {
        /**
         * Enable organization Razorpay customer
         */
        enabled: true;
        /**
         * Custom function to get customer create params
         * for organization customers
         */
        getCustomerCreateParams?:
          | ((
              organization: Organization,
              ctx: GenericEndpointContext,
            ) => Promise<Record<string, unknown>>)
          | undefined;
        /**
         * A callback to run after an organization customer has been created
         */
        onCustomerCreate?:
          | ((
              data: {
                razorpayCustomer: {
                  id: string;
                  entity: string;
                  name: string;
                  email: string;
                };
                organization: Organization & WithRazorpayCustomerId;
              },
              ctx: GenericEndpointContext,
            ) => Promise<void>)
          | undefined;
      }
    | undefined;
  /**
   * A callback to run after a Razorpay webhook event is received
   */
  onEvent?: ((event: RazorpayWebhookEvent) => Promise<void>) | undefined;
  /**
   * Payment webhook callbacks
   */
  onPaymentAuthorized?:
    | ((data: {
        event: RazorpayWebhookEvent;
        payment: RazorpayPaymentEntity;
      }) => Promise<void>)
    | undefined;
  onPaymentCaptured?:
    | ((data: {
        event: RazorpayWebhookEvent;
        payment: RazorpayPaymentEntity;
      }) => Promise<void>)
    | undefined;
  onPaymentFailed?:
    | ((data: {
        event: RazorpayWebhookEvent;
        payment: RazorpayPaymentEntity;
      }) => Promise<void>)
    | undefined;
  /**
   * Order webhook callbacks
   */
  onOrderPaid?:
    | ((data: {
        event: RazorpayWebhookEvent;
        order: RazorpayOrderEntity;
      }) => Promise<void>)
    | undefined;
  /**
   * Refund webhook callbacks
   */
  onRefundCreated?:
    | ((data: {
        event: RazorpayWebhookEvent;
        refund: RazorpayRefundEntity;
      }) => Promise<void>)
    | undefined;
  onRefundProcessed?:
    | ((data: {
        event: RazorpayWebhookEvent;
        refund: RazorpayRefundEntity;
      }) => Promise<void>)
    | undefined;
  onRefundFailed?:
    | ((data: {
        event: RazorpayWebhookEvent;
        refund: RazorpayRefundEntity;
      }) => Promise<void>)
    | undefined;
  /**
   * Invoice webhook callbacks
   */
  onInvoicePaid?:
    | ((data: {
        event: RazorpayWebhookEvent;
        invoice: RazorpayInvoiceEntity;
      }) => Promise<void>)
    | undefined;
  onInvoicePartiallyPaid?:
    | ((data: {
        event: RazorpayWebhookEvent;
        invoice: RazorpayInvoiceEntity;
      }) => Promise<void>)
    | undefined;
  onInvoiceExpired?:
    | ((data: {
        event: RazorpayWebhookEvent;
        invoice: RazorpayInvoiceEntity;
      }) => Promise<void>)
    | undefined;
  /**
   * Schema for the razorpay plugin
   */
  schema?:
    | InferOptionSchema<
        typeof subscriptions & typeof user & typeof organization
      >
    | undefined;
}

export type RazorpayPluginOptions = RazorpayOptions;

export type RazorpayNotes = Record<string, string | number | null>;

export type CreateRazorpayOrderInput = {
  amount: number;
  currency?: string | undefined;
  receipt?: string | undefined;
  notes?: RazorpayNotes | undefined;
  partialPayment?: boolean | undefined;
  firstPaymentMinAmount?: number | undefined;
};

export type VerifyRazorpayPaymentInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type RazorpayOrderResponse = {
  id: string;
  entity: string;
  amount: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  receipt: string | null;
  status: string;
  attempts: number;
  notes: RazorpayNotes;
  createdAt: number;
};

export type RazorpayPaymentResponse = {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  orderId: string | null;
  invoiceId: string | null;
  method: string;
  captured: boolean;
  amountRefunded: number;
  refundStatus: string | null;
  email: string | null;
  contact: string | null;
  notes: RazorpayNotes;
  errorCode: string | null;
  errorDescription: string | null;
  createdAt: number;
};

export type CaptureRazorpayPaymentInput = {
  paymentId: string;
  amount: number;
  currency?: string | undefined;
};

export type RefundRazorpayPaymentInput = {
  paymentId: string;
  amount?: number | undefined;
  speed?: "normal" | "optimum" | undefined;
  receipt?: string | undefined;
  notes?: RazorpayNotes | undefined;
};

export type RazorpayRefundResponse = {
  id: string;
  entity: string;
  amount: number | null;
  currency: string;
  paymentId: string;
  receipt: string | null;
  status: string;
  notes: RazorpayNotes;
  createdAt: number;
  speedRequested: string | null;
  speedProcessed: string | null;
};

export type VerifyRazorpayPaymentResponse = {
  valid: boolean;
};

// ─── Pagination ─────────────────────────────────────────────────────────────

export type RazorpayPaginationQuery = {
  from?: number | undefined;
  to?: number | undefined;
  count?: number | undefined;
  skip?: number | undefined;
};

// ─── Payments: Fetch All ────────────────────────────────────────────────────

export type FetchAllPaymentsQuery = RazorpayPaginationQuery & {
  expand?: string | undefined;
  referenceId?: string | undefined;
  transfer?: boolean | undefined;
};

export type RazorpayPaymentListResponse = {
  entity: string;
  count: number;
  items: RazorpayPaymentResponse[];
};

// ─── Payments: Edit Notes ───────────────────────────────────────────────────

export type EditPaymentBody = {
  paymentId: string;
  notes: RazorpayNotes;
};

// ─── Refunds ────────────────────────────────────────────────────────────────

export type FetchRefundQuery = {
  refundId: string;
  paymentId?: string | undefined;
};

export type FetchAllRefundsQuery = RazorpayPaginationQuery;

export type EditRefundBody = {
  refundId: string;
  notes: RazorpayNotes;
};

export type RazorpayRefundSingleResponse = RazorpayRefundEntity;

export type RazorpayRefundListResponse = {
  entity: string;
  count: number;
  items: RazorpayRefundResponse[];
};

// ─── Invoices ───────────────────────────────────────────────────────────────

export type RazorpayInvoiceLineItemIdBody = {
  id?: string | undefined;
  item_id?: string | undefined;
  quantity?: number | undefined;
  amount?: number | string | undefined;
  gross_amount?: number | undefined;
  tax_amount?: number | undefined;
  taxable_amount?: number | undefined;
  net_amount?: number | undefined;
  type?: string | undefined;
  sku?: string | undefined;
  variant_id?: string | undefined;
  price?: string | undefined;
  offer_price?: string | undefined;
  tax_amount_value?: number | undefined;
  name?: string | undefined;
  description?: string | undefined;
  weight?: string | undefined;
  dimensions?: Record<string, unknown> | undefined;
  image_url?: string | undefined;
  product_url?: string | undefined;
  notes?: RazorpayNotes | undefined;
};

export type RazorpayInvoiceAddressBody = {
  line1: string;
  line2?: string | undefined;
  zipcode: string | number;
  city: string;
  state?: string | undefined;
  country: string;
};

export type CreateInvoiceBody = {
  type?: "invoice" | "link" | undefined;
  description?: string | null | undefined;
  date?: number | null | undefined;
  customer_id?: string | undefined;
  currency?: string | undefined;
  customer?: {
    name?: string | null | undefined;
    email?: string | null | undefined;
    contact?: string | number | null | undefined;
    billing_address?: RazorpayInvoiceAddressBody | undefined;
    shipping_address?: RazorpayInvoiceAddressBody | undefined;
  } | null | undefined;
  order_id?: string | undefined;
  line_items: RazorpayInvoiceLineItemIdBody[];
  expire_by?: number | null | undefined;
  sms_notify?: boolean | 0 | 1 | undefined;
  email_notify?: boolean | 0 | 1 | undefined;
  partial_payment?: boolean | 0 | 1 | undefined;
  notes?: RazorpayNotes | undefined;
  receipt?: string | null | undefined;
  amount?: number | string | undefined;
};

export type FetchInvoiceQuery = {
  invoiceId: string;
};

export type EditInvoiceBody = {
  invoiceId: string;
  notes?: RazorpayNotes | undefined;
  customer_details?: Record<string, unknown> | undefined;
  line_items?: RazorpayInvoiceLineItemIdBody[] | undefined;
  expire_by?: number | null | undefined;
  sms_notify?: boolean | 0 | 1 | undefined;
  email_notify?: boolean | 0 | 1 | undefined;
  partial_payment?: boolean | 0 | 1 | undefined;
  receipt?: string | null | undefined;
};

export type FetchAllInvoicesQuery = RazorpayPaginationQuery & {
  type?: string | undefined;
  payment_id?: string | undefined;
  receipt?: string | undefined;
  customer_id?: string | undefined;
  subscription_id?: string | undefined;
};

export type IssueInvoiceQuery = {
  invoiceId: string;
};

export type DeleteInvoiceQuery = {
  invoiceId: string;
};

export type CancelInvoiceQuery = {
  invoiceId: string;
};

export type NotifyByInvoiceBody = {
  invoiceId: string;
  medium: "email" | "sms";
};

export type RazorpayInvoiceResponse = RazorpayInvoiceEntity;

export type RazorpayInvoiceListResponse = {
  entity: string;
  count: number;
  items: RazorpayInvoiceEntity[];
};

// ─── Orders ─────────────────────────────────────────────────────────────────

export type EditOrderBody = {
  orderId: string;
  notes: RazorpayNotes;
};

export type FetchPaymentsForOrderQuery = {
  orderId: string;
};

export type FetchAllOrdersQuery = RazorpayPaginationQuery & {
  authorized?: boolean | undefined;
  receipt?: string | undefined;
  expand?: string | undefined;
};

export type RazorpayOrderListResponse = {
  entity: string;
  count: number;
  items: RazorpayOrderResponse[];
};

export type RazorpayPaymentListForOrderResponse = {
  entity: string;
  count: number;
  items: RazorpayPaymentResponse[];
};

// ─── Customers: Bank Accounts ───────────────────────────────────────────────

export type AddBankAccountBody = {
  customerId: string;
  ifsc_code: string;
  account_number: string;
  beneficiary_name?: string | undefined;
};

export type DeleteBankAccountQuery = {
  customerId: string;
  bankAccountId: string;
};

export type RazorpayBankAccountResponse = {
  id: string;
  entity: string;
  ifsc: string;
  bank_account: {
    ifsc: string;
    bank: string;
    account_number: string;
    account_type: "savings" | "current";
  };
  created_at: number;
  [key: string]: unknown;
};

// ─── Customers: Tokens ─────────────────────────────────────────────────────

export type FetchTokensQuery = {
  customerId: string;
};

export type FetchTokenQuery = {
  customerId: string;
  tokenId: string;
};

export type DeleteTokenQuery = {
  customerId: string;
  tokenId: string;
};

export type RazorpayTokenListResponse = {
  entity: string;
  count: number;
  items: RazorpayTokenEntity[];
};

export type RazorpayTokenEntity = {
  id: string;
  entity: string;
  token: string;
  bank: string | null;
  wallet: string | null;
  method: string;
  recurring: boolean;
  created_at: number;
  [key: string]: unknown;
};

export type RazorpayTokenDeleteResponse = {
  deleted: boolean;
};

// ─── Add-ons (standalone) ──────────────────────────────────────────────────

export type FetchAddonQuery = {
  addonId: string;
};

export type DeleteAddonQuery = {
  addonId: string;
};

export type FetchAllAddonsQuery = RazorpayPaginationQuery;

export type RazorpayAddonResponse = RazorpayAddonEntity;

export type RazorpayAddonListResponse = {
  entity: string;
  count: number;
  items: RazorpayAddonEntity[];
};

// ─── Items ──────────────────────────────────────────────────────────────────

export type CreateItemBody = {
  name: string;
  amount: number | string;
  currency: string;
  description?: string | undefined;
  active?: boolean | undefined;
  tax_inclusive?: boolean | undefined;
  hsn_code?: number | undefined;
  sac_code?: number | undefined;
  tax_rate?: number | undefined;
  tax_id?: string | undefined;
  tax_group_id?: string | undefined;
};

export type FetchItemQuery = {
  itemId: string;
};

export type EditItemBody = {
  itemId: string;
  name?: string | undefined;
  amount?: number | string | undefined;
  currency?: string | undefined;
  description?: string | undefined;
  active?: boolean | undefined;
  tax_inclusive?: boolean | undefined;
  hsn_code?: number | undefined;
  sac_code?: number | undefined;
  tax_rate?: number | undefined;
  tax_id?: string | undefined;
  tax_group_id?: string | undefined;
};

export type DeleteItemQuery = {
  itemId: string;
};

export type FetchAllItemsQuery = RazorpayPaginationQuery & {
  active?: number | undefined;
};

export type RazorpayItemResponse = RazorpayItemEntity;

export type RazorpayItemListResponse = {
  entity: string;
  count: number;
  items: RazorpayItemEntity[];
};

// ─── Subscriptions: Create Add-on ───────────────────────────────────────────

export type CreateSubscriptionAddonBody = {
  subscriptionId: string;
  item:
    | { id: string }
    | { name: string; amount: number; currency: string; description?: string };
  quantity?: number | undefined;
};

// ─── Subscriptions: Fetch All from Razorpay ─────────────────────────────────

export type FetchAllSubscriptionsQuery = {
  from?: number;
  to?: number;
  count?: number;
  skip?: number;
  planId?: string;
  status?:
    | "created"
    | "authenticated"
    | "active"
    | "pending"
    | "halted"
    | "paused"
    | "cancelled"
    | "reverted"
    | "expired"
    | "completed";
  expand?: string;
};
