import { createAuthEndpoint } from "@better-auth/core/api";
import { z } from "zod";
import { RAZORPAY_ERROR_CODES } from "./error-codes";
import {
  onSubscriptionActivated,
  onSubscriptionAuthenticated,
  onSubscriptionCancelled,
  onSubscriptionCharged,
  onSubscriptionCompleted,
  onSubscriptionHalted,
  onSubscriptionPaused,
  onSubscriptionPending,
  onSubscriptionResumed,
  onSubscriptionUpdated,
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
} from "./hooks";
import { subscriptionNotes } from "./metadata";
import { razorpaySessionMiddleware, referenceMiddleware } from "./middleware";
import { verifyRazorpayWebhookSignature } from "./signature";
import {
  createAPIError,
  getPlans,
  isActive,
  isCancelled,
  isPaused,
  isTerminal,
} from "./utils";
import {
  serializeRazorpayPayment,
  serializeRazorpayPaymentList,
  serializeRazorpayPaymentListForOrder,
  serializeRazorpayOrderList,
  serializeRazorpayRefund,
  serializeRazorpayRefundList,
} from "./razorpay";
import { sanitizeRazorpayNotes } from "./notes";
import type {
  RazorpayOptions,
  RazorpayWebhookEvent,
  Subscription,
  WithRazorpayCustomerId,
  RazorpayPaymentResponse,
  RazorpayPaymentListResponse,
  RazorpayPaymentListForOrderResponse,
  RazorpayRefundResponse,
  RazorpayRefundListResponse,
  RazorpayOrderListResponse,
  RazorpayInvoiceResponse,
  RazorpayInvoiceListResponse,
  RazorpayItemResponse,
  RazorpayItemListResponse,
  RazorpayAddonResponse,
  RazorpayAddonListResponse,
  RazorpayBankAccountResponse,
  RazorpayTokenListResponse,
  RazorpayTokenEntity,
  RazorpayTokenDeleteResponse,
} from "./types";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const notesSchema = z
  .record(z.string().max(256), z.union([z.string().max(256), z.number()]))
  .refine((notes) => Object.keys(notes).length <= 15, {
    message: "Razorpay notes can contain at most 15 key-value pairs.",
  });

const lineItemSchema = z.object({
  item_id: z.string(),
  quantity: z.number().optional(),
});

const upgradeSubscriptionBodySchema = z.object({
  plan: z.string(),
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  annual: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lineItems: z.array(lineItemSchema).optional(),
  scheduleAtPeriodEnd: z.boolean().optional(),
});

const cancelSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  cancelAtCycleEnd: z.boolean().optional(),
});

const pauseSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  pauseAt: z.literal("now").optional(),
});

const resumeSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  resumeAt: z.literal("now").optional(),
});

const listSubscriptionsQuerySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
});

const updateSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
  planId: z.string().optional(),
  offerId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  remainingCount: z.number().int().positive().optional(),
  startAt: z.number().int().positive().optional(),
  scheduleChangeAt: z.enum(["now", "cycle_end"]).optional(),
  customerNotify: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const restoreSubscriptionBodySchema = z.object({
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
});

const getSubscriptionQuerySchema = z.object({
  subscriptionId: z.string(),
  referenceId: z.string().optional(),
  customerType: z.enum(["user", "organization"]).optional(),
});

const fetchSubscriptionQuerySchema = z.object({
  subscriptionId: z.string(),
});

const createPlanBodySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  interval: z.number().int().positive(),
  itemName: z.string().min(1),
  itemAmount: z.number().int().positive(),
  itemCurrency: z.string().length(3).toUpperCase().default("INR"),
  itemDescription: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

const fetchPlanQuerySchema = z.object({
  planId: z.string(),
});

const subscriptionAddonSchema = z.object({
  item: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    amount: z.number().int().positive().optional(),
    currency: z.string().length(3).toUpperCase().optional(),
    description: z.string().optional(),
  }),
  quantity: z.number().int().positive().optional(),
});

const subscriptionLinkBodySchema = z.object({
  planId: z.string(),
  totalCount: z.number().int().positive(),
  quantity: z.number().int().positive().optional(),
  startAt: z.number().int().positive().optional(),
  expireBy: z.number().int().positive().optional(),
  customerNotify: z.boolean().optional(),
  addons: z.array(subscriptionAddonSchema).optional(),
  offerId: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
  notifyInfo: z
    .object({
      notifyPhone: z.union([z.string(), z.number()]).optional(),
      notifyEmail: z.string().email().optional(),
    })
    .optional(),
});

const pendingUpdateQuerySchema = z.object({
  subscriptionId: z.string(),
});

const cancelUpdateBodySchema = z.object({
  subscriptionId: z.string(),
});

const invoicesQuerySchema = z.object({
  subscriptionId: z.string(),
});

const linkOfferBodySchema = z.object({
  subscriptionId: z.string(),
  offerId: z.string(),
});

const deleteOfferBodySchema = z.object({
  subscriptionId: z.string(),
  offerId: z.string(),
});

const createCustomerBodySchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  contact: z.string().optional(),
  failExisting: z.boolean().optional(),
  gstin: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

const editCustomerBodySchema = z.object({
  customerId: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  contact: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

const fetchCustomerQuerySchema = z.object({
  customerId: z.string(),
});

// ─── Refund Schemas ───────────────────────────────────────────────────

const fetchRefundQuerySchema = z.object({
  refundId: z.string().min(1),
  paymentId: z.string().optional(),
});

const fetchAllRefundsQuerySchema = z.object({
  from: z.number().optional(),
  to: z.number().optional(),
  count: z.number().int().positive().max(100).optional(),
  skip: z.number().int().min(0).optional(),
});

const editRefundBodySchema = z.object({
  refundId: z.string().min(1),
  notes: notesSchema,
});

// ─── Invoice Schemas ──────────────────────────────────────────────────

const fetchInvoiceQuerySchema = z.object({
  invoiceId: z.string().min(1),
});

const fetchAllInvoicesQuerySchema = z.object({
  from: z.number().optional(),
  to: z.number().optional(),
  count: z.number().int().positive().max(100).optional(),
  skip: z.number().int().min(0).optional(),
  type: z.string().optional(),
  payment_id: z.string().optional(),
  receipt: z.string().optional(),
  customer_id: z.string().optional(),
  subscription_id: z.string().optional(),
});

const issueInvoiceQuerySchema = z.object({
  invoiceId: z.string().min(1),
});

const deleteInvoiceQuerySchema = z.object({
  invoiceId: z.string().min(1),
});

const cancelInvoiceQuerySchema = z.object({
  invoiceId: z.string().min(1),
});

const notifyByInvoiceBodySchema = z.object({
  invoiceId: z.string().min(1),
  medium: z.enum(["email", "sms"]),
});

const invoiceLineItemBaseSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  description: z.string().optional(),
  quantity: z.number().int().positive().optional(),
});

const invoiceAddressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  zipcode: z.union([z.string(), z.number()]),
  city: z.string(),
  state: z.string().optional(),
  country: z.string(),
});

const createInvoiceBodySchema = z.object({
  type: z.enum(["invoice", "link"]).optional(),
  description: z.string().nullable().optional(),
  date: z.number().nullable().optional(),
  customer_id: z.string().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  customer: z
    .object({
      name: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      contact: z.union([z.string(), z.number()]).nullable().optional(),
      billing_address: invoiceAddressSchema.optional(),
      shipping_address: invoiceAddressSchema.optional(),
    })
    .nullable()
    .optional(),
  order_id: z.string().optional(),
  line_items: z.array(invoiceLineItemBaseSchema).min(1),
  expire_by: z.number().nullable().optional(),
  sms_notify: z.union([z.boolean(), z.number()]).optional(),
  email_notify: z.union([z.boolean(), z.number()]).optional(),
  partial_payment: z.union([z.boolean(), z.number()]).optional(),
  notes: notesSchema.optional(),
  receipt: z.string().nullable().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
});

const editInvoiceBodySchema = z.object({
  invoiceId: z.string().min(1),
  notes: notesSchema.optional(),
  customer_details: z.record(z.string(), z.unknown()).optional(),
  line_items: z.array(invoiceLineItemBaseSchema).optional(),
  expire_by: z.number().nullable().optional(),
  sms_notify: z.union([z.boolean(), z.number()]).optional(),
  email_notify: z.union([z.boolean(), z.number()]).optional(),
  partial_payment: z.union([z.boolean(), z.number()]).optional(),
  receipt: z.string().nullable().optional(),
});

// ─── Order Schemas ────────────────────────────────────────────────────

const editOrderBodySchema = z.object({
  orderId: z.string().min(1),
  notes: notesSchema,
});

const fetchPaymentsForOrderQuerySchema = z.object({
  orderId: z.string().min(1),
});

const fetchAllOrdersQuerySchema = z.object({
  from: z.number().optional(),
  to: z.number().optional(),
  count: z.number().int().positive().max(100).optional(),
  skip: z.number().int().min(0).optional(),
  authorized: z.boolean().optional(),
  receipt: z.string().optional(),
  expand: z.string().optional(),
});

// ─── Payment Schemas ──────────────────────────────────────────────────

const fetchAllPaymentsQuerySchema = z.object({
  from: z.number().optional(),
  to: z.number().optional(),
  count: z.number().int().positive().max(100).optional(),
  skip: z.number().int().min(0).optional(),
  expand: z.string().optional(),
  reference_id: z.string().optional(),
  transfer: z.boolean().optional(),
});

const editPaymentBodySchema = z.object({
  paymentId: z.string().min(1),
  notes: notesSchema,
});

// ─── Customer Bank Account Schemas ────────────────────────────────────

const addBankAccountBodySchema = z.object({
  customerId: z.string().min(1),
  ifsc_code: z.string().min(1),
  account_number: z.string().min(1),
  beneficiary_name: z.string().optional(),
});

const deleteBankAccountQuerySchema = z.object({
  customerId: z.string().min(1),
  bankAccountId: z.string().min(1),
});

// ─── Customer Token Schemas ───────────────────────────────────────────

const fetchTokensQuerySchema = z.object({
  customerId: z.string().min(1),
});

const fetchTokenQuerySchema = z.object({
  customerId: z.string().min(1),
  tokenId: z.string().min(1),
});

const deleteTokenQuerySchema = z.object({
  customerId: z.string().min(1),
  tokenId: z.string().min(1),
});

// ─── Add-on Schemas ───────────────────────────────────────────────────

const fetchAddonQuerySchema = z.object({
  addonId: z.string().min(1),
});

const deleteAddonQuerySchema = z.object({
  addonId: z.string().min(1),
});

const fetchAllAddonsQuerySchema = z.object({
  from: z.number().optional(),
  to: z.number().optional(),
  count: z.number().int().positive().max(100).optional(),
  skip: z.number().int().min(0).optional(),
});

// ─── Item Schemas ─────────────────────────────────────────────────────

const createItemBodySchema = z.object({
  name: z.string().min(1),
  amount: z.union([z.number(), z.string()]),
  currency: z.string().length(3).toUpperCase(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  tax_inclusive: z.boolean().optional(),
  hsn_code: z.number().optional(),
  sac_code: z.number().optional(),
  tax_rate: z.number().optional(),
  tax_id: z.string().optional(),
  tax_group_id: z.string().optional(),
});

const fetchItemQuerySchema = z.object({
  itemId: z.string().min(1),
});

const editItemBodySchema = z.object({
  itemId: z.string().min(1),
  name: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  tax_inclusive: z.boolean().optional(),
  hsn_code: z.number().optional(),
  sac_code: z.number().optional(),
  tax_rate: z.number().optional(),
  tax_id: z.string().optional(),
  tax_group_id: z.string().optional(),
});

const deleteItemQuerySchema = z.object({
  itemId: z.string().min(1),
});

const fetchAllItemsQuerySchema = z.object({
  from: z.number().optional(),
  to: z.number().optional(),
  count: z.number().int().positive().max(100).optional(),
  skip: z.number().int().min(0).optional(),
  active: z.number().int().min(0).max(1).optional(),
});

// ─── Subscription Add-on Schema ──────────────────────────────────────

const createSubscriptionAddonBodySchema = z.object({
  subscriptionId: z.string().min(1),
  item: z.union([
    z.object({ id: z.string().min(1) }),
    z.object({
      name: z.string().min(1),
      amount: z.number().int().positive(),
      currency: z.string().length(3).toUpperCase(),
      description: z.string().optional(),
    }),
  ]),
  quantity: z.number().int().positive().optional(),
});

// ─── Subscription Endpoints ──────────────────────────────────────────────────

/**
 * POST /subscription/upgrade
 *
 * Create a new subscription or upgrade to a different plan.
 */
export const upgradeSubscription = (options: RazorpayOptions) => {
  if (!options.subscription?.enabled) {
    throw new Error("Subscriptions must be enabled to use upgradeSubscription");
  }
  const subscriptionOptions = options.subscription;
  return createAuthEndpoint(
    "/subscription/upgrade",
    {
      method: "POST",
      body: upgradeSubscriptionBodySchema,
      metadata: {
        openapi: {
          summary: "Upgrade or create subscription",
          description:
            "Create a new Razorpay subscription or upgrade to a different plan",
          responses: {
            200: {
              description: "Subscription created/upgraded successfully",
            },
          },
        },
      },
      use: [
        razorpaySessionMiddleware,
        referenceMiddleware(subscriptionOptions, "upgrade-subscription"),
      ],
    },
    async (ctx) => {
      const { plan: planName, referenceId: bodyReferenceId, annual } = ctx.body;
      const session = ctx.context.session;
      const user = session.user as typeof session.user & WithRazorpayCustomerId;

      // Verify email if required
      if (subscriptionOptions.requireEmailVerification && !user.emailVerified) {
        throw createAPIError(
          "FORBIDDEN",
          RAZORPAY_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
        );
      }

      // Resolve plans
      const plans = await getPlans(options.subscription);
      if (!plans) {
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.FAILED_TO_FETCH_PLANS,
        );
      }

      const plan = plans.find(
        (p) => p.name.toLowerCase() === planName.toLowerCase(),
      );
      if (!plan) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
        );
      }

      // Determine reference
      const customerType = ctx.body.customerType || "user";
      const referenceId =
        bodyReferenceId ||
        (customerType === "organization"
          ? session.session.activeOrganizationId
          : user.id);

      if (!referenceId) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.ORGANIZATION_REFERENCE_ID_REQUIRED,
        );
      }

      // Check for customer
      const razorpayCustomerId = user.razorpayCustomerId;
      if (!razorpayCustomerId) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.CUSTOMER_NOT_FOUND,
        );
      }

      // Check for existing active subscription in same group
      const existingSubs = await ctx.context.adapter.findMany<Subscription>({
        model: "subscription",
        where: [
          { field: "referenceId", value: referenceId },
          ...(plan.group
            ? [{ field: "groupId" as const, value: plan.group }]
            : []),
        ],
      });

      const activeSub = existingSubs.find(
        (s) => isActive(s) || s.status === "authenticated",
      );
      if (activeSub && activeSub.plan === plan.name.toLowerCase()) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.ALREADY_SUBSCRIBED_PLAN,
        );
      }

      // Determine which plan ID to use
      const razorpayPlanId =
        annual && plan.annualPlanId ? plan.annualPlanId : plan.planId;

      // Create subscription record in DB first
      const now = new Date();
      const hasTrialAndEligible =
        plan.freeTrial?.days &&
        !(await ctx.context.adapter.findMany<Subscription>({
          model: "subscription",
          where: [{ field: "referenceId", value: referenceId }],
        })).some((s) => s.trialStart !== undefined && s.trialStart !== null);

      const trialEndDate = hasTrialAndEligible
        ? new Date(
            now.getTime() + plan.freeTrial!.days * 24 * 60 * 60 * 1000,
          )
        : undefined;

      const dbSubscription = await ctx.context.adapter.create<Subscription>({
        model: "subscription",
        data: {
          plan: plan.name.toLowerCase(),
          referenceId,
          razorpayCustomerId,
          razorpayPlanId: razorpayPlanId,
          status: "created",
          quantity: plan.quantity || 1,
          totalCount: plan.totalCount || 0,
          ...(plan.group ? { groupId: plan.group } : {}),
          ...(hasTrialAndEligible
            ? { trialStart: now, trialEnd: trialEndDate }
            : {}),
          ...(ctx.body.metadata
            ? { metadata: JSON.stringify(ctx.body.metadata) }
            : {}),
          billingPeriod: annual ? "yearly" : "monthly",
        },
      });

      // Create Razorpay subscription
      const client = options.razorpayClient!;

      const subscriptionCreateParams: Record<string, unknown> = {
        plan_id: razorpayPlanId,
        customer_id: razorpayCustomerId,
        quantity: plan.quantity || 1,
        total_count: plan.totalCount || 0,
        notes: subscriptionNotes.set({
          userId: user.id,
          subscriptionId: dbSubscription.id,
          referenceId,
        }),
      };

      // Add free trial offset (skip if user already had a trial)
      if (plan.freeTrial?.days && hasTrialAndEligible) {
        subscriptionCreateParams.start_at = Math.floor(
          trialEndDate!.getTime() / 1000,
        );
      }

      // Add line items as Razorpay add-ons
      if (ctx.body.lineItems && ctx.body.lineItems.length > 0) {
        subscriptionCreateParams.addons = ctx.body.lineItems.map(
          (item: { item_id: string; quantity?: number | undefined }) => ({
            item: { id: item.item_id },
            ...(item.quantity ? { quantity: item.quantity } : {}),
          }),
        );
      }

      // Schedule plan change at end of billing period (for existing sub upgrades)
      if (ctx.body.scheduleAtPeriodEnd) {
        subscriptionCreateParams.schedule_change_at = "cycle_end";
      }

      // Allow user customization
      if (subscriptionOptions.getSubscriptionCreateParams) {
        const extra = await subscriptionOptions.getSubscriptionCreateParams(
          { user, session: session.session, plan },
          ctx,
        );
        Object.assign(subscriptionCreateParams, extra);
      }

      try {
        const razorpaySub = await (client.subscriptions as any).create(
          subscriptionCreateParams,
        );

        // Update DB with Razorpay subscription ID
        const updated = await ctx.context.adapter.update<Subscription>({
          model: "subscription",
          update: {
            razorpaySubscriptionId: razorpaySub.id,
            shortUrl: razorpaySub.short_url || null,
            updatedAt: new Date(),
          },
          where: [{ field: "id", value: dbSubscription.id }],
        });

        return ctx.json({
          subscription: updated || dbSubscription,
          razorpaySubscription: razorpaySub,
        });
      } catch (error: any) {
        // Cleanup DB record on failure
        await ctx.context.adapter.delete({
          model: "subscription",
          where: [{ field: "id", value: dbSubscription.id }],
        });
        ctx.context.logger.error(
          `Failed to create Razorpay subscription: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_UPDATE_FAILED,
        );
      }
    },
  );
};

/**
 * POST /subscription/cancel
 *
 * Cancel an active subscription.
 */
export const cancelSubscription = (options: RazorpayOptions) => {
  if (!options.subscription?.enabled) {
    throw new Error("Subscriptions must be enabled");
  }
  const subscriptionOptions = options.subscription;
  return createAuthEndpoint(
    "/subscription/cancel",
    {
      method: "POST",
      body: cancelSubscriptionBodySchema,
      metadata: {
        openapi: {
          summary: "Cancel subscription",
          description: "Cancel an active Razorpay subscription",
          responses: { 200: { description: "Subscription cancelled" } },
        },
      },
      use: [
        razorpaySessionMiddleware,
        referenceMiddleware(subscriptionOptions, "cancel-subscription"),
      ],
    },
    async (ctx) => {
      const session = ctx.context.session;
      const user = session.user as typeof session.user & WithRazorpayCustomerId;
      const customerType = ctx.body.customerType || "user";
      const referenceId =
        ctx.body.referenceId ||
        (customerType === "organization"
          ? session.session.activeOrganizationId
          : user.id);

      if (!referenceId) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.ORGANIZATION_REFERENCE_ID_REQUIRED,
        );
      }

      const subscription = await ctx.context.adapter.findOne<Subscription>({
        model: "subscription",
        where: [{ field: "referenceId", value: referenceId }],
      });

      if (!subscription?.razorpaySubscriptionId) {
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        );
      }

      if (isCancelled(subscription) || isTerminal(subscription)) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_ALREADY_CANCELLED,
        );
      }

      try {
        const client = options.razorpayClient!;
        const cancelAtCycleEnd = ctx.body.cancelAtCycleEnd ?? false;

        await (client.subscriptions as any).cancel(
          subscription.razorpaySubscriptionId,
          cancelAtCycleEnd,
        );

        const updated = await ctx.context.adapter.update<Subscription>({
          model: "subscription",
          update: {
            ...(cancelAtCycleEnd
              ? { cancelAtCycleEnd: true }
              : {
                  status: "cancelled",
                  cancelledAt: new Date(),
                  endedAt: new Date(),
                }),
            updatedAt: new Date(),
          },
          where: [{ field: "id", value: subscription.id }],
        });

        return ctx.json({ subscription: updated || subscription });
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to cancel subscription: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_CANCEL_FAILED,
        );
      }
    },
  );
};

/**
 * POST /subscription/pause
 *
 * Pause an active subscription (Razorpay-specific).
 */
export const pauseSubscription = (options: RazorpayOptions) => {
  if (!options.subscription?.enabled) {
    throw new Error("Subscriptions must be enabled");
  }
  const subscriptionOptions = options.subscription;
  return createAuthEndpoint(
    "/subscription/pause",
    {
      method: "POST",
      body: pauseSubscriptionBodySchema,
      metadata: {
        openapi: {
          summary: "Pause subscription",
          description: "Pause an active Razorpay subscription",
          responses: { 200: { description: "Subscription paused" } },
        },
      },
      use: [
        razorpaySessionMiddleware,
        referenceMiddleware(subscriptionOptions, "pause-subscription"),
      ],
    },
    async (ctx) => {
      const session = ctx.context.session;
      const user = session.user as typeof session.user & WithRazorpayCustomerId;
      const customerType = ctx.body.customerType || "user";
      const referenceId =
        ctx.body.referenceId ||
        (customerType === "organization"
          ? session.session.activeOrganizationId
          : user.id);

      if (!referenceId) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.ORGANIZATION_REFERENCE_ID_REQUIRED,
        );
      }

      const subscription = await ctx.context.adapter.findOne<Subscription>({
        model: "subscription",
        where: [{ field: "referenceId", value: referenceId }],
      });

      if (!subscription?.razorpaySubscriptionId) {
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        );
      }

      if (!isActive(subscription)) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_ACTIVE,
        );
      }

      if (isPaused(subscription)) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_ALREADY_PAUSED,
        );
      }

      try {
        const client = options.razorpayClient!;
        await (client.subscriptions as any).pause(
          subscription.razorpaySubscriptionId,
          { pause_at: ctx.body.pauseAt || "now" },
        );

        const updated = await ctx.context.adapter.update<Subscription>({
          model: "subscription",
          update: {
            status: "paused",
            pausedAt: new Date(),
            updatedAt: new Date(),
          },
          where: [{ field: "id", value: subscription.id }],
        });

        return ctx.json({ subscription: updated || subscription });
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to pause subscription: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_PAUSE_FAILED,
        );
      }
    },
  );
};

/**
 * POST /subscription/resume
 *
 * Resume a paused subscription (Razorpay-specific).
 */
export const resumeSubscription = (options: RazorpayOptions) => {
  if (!options.subscription?.enabled) {
    throw new Error("Subscriptions must be enabled");
  }
  const subscriptionOptions = options.subscription;
  return createAuthEndpoint(
    "/subscription/resume",
    {
      method: "POST",
      body: resumeSubscriptionBodySchema,
      metadata: {
        openapi: {
          summary: "Resume subscription",
          description: "Resume a paused Razorpay subscription",
          responses: { 200: { description: "Subscription resumed" } },
        },
      },
      use: [
        razorpaySessionMiddleware,
        referenceMiddleware(subscriptionOptions, "resume-subscription"),
      ],
    },
    async (ctx) => {
      const session = ctx.context.session;
      const user = session.user as typeof session.user & WithRazorpayCustomerId;
      const customerType = ctx.body.customerType || "user";
      const referenceId =
        ctx.body.referenceId ||
        (customerType === "organization"
          ? session.session.activeOrganizationId
          : user.id);

      if (!referenceId) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.ORGANIZATION_REFERENCE_ID_REQUIRED,
        );
      }

      const subscription = await ctx.context.adapter.findOne<Subscription>({
        model: "subscription",
        where: [{ field: "referenceId", value: referenceId }],
      });

      if (!subscription?.razorpaySubscriptionId) {
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        );
      }

      if (!isPaused(subscription)) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_PAUSED,
        );
      }

      try {
        const client = options.razorpayClient!;
        await (client.subscriptions as any).resume(
          subscription.razorpaySubscriptionId,
          { resume_at: ctx.body.resumeAt || "now" },
        );

        const updated = await ctx.context.adapter.update<Subscription>({
          model: "subscription",
          update: {
            status: "active",
            pausedAt: null,
            updatedAt: new Date(),
          },
          where: [{ field: "id", value: subscription.id }],
        });

        return ctx.json({ subscription: updated || subscription });
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to resume subscription: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_RESUME_FAILED,
        );
      }
    },
  );
};

/**
 * GET /subscription/list
 *
 * List subscriptions for the current user or reference.
 */
export const listSubscriptions = (options: RazorpayOptions) => {
  if (!options.subscription?.enabled) {
    throw new Error("Subscriptions must be enabled");
  }
  const subscriptionOptions = options.subscription;
  return createAuthEndpoint(
    "/subscription/list",
    {
      method: "GET",
      query: listSubscriptionsQuerySchema,
      metadata: {
        openapi: {
          summary: "List subscriptions",
          description:
            "List all subscriptions for the current user or reference",
          responses: { 200: { description: "Subscriptions list" } },
        },
      },
      use: [
        razorpaySessionMiddleware,
        referenceMiddleware(subscriptionOptions, "list-subscription"),
      ],
    },
    async (ctx) => {
      const session = ctx.context.session;
      const user = session.user as typeof session.user & WithRazorpayCustomerId;
      const customerType = ctx.query?.customerType || "user";
      const referenceId =
        ctx.query?.referenceId ||
        (customerType === "organization"
          ? session.session.activeOrganizationId
          : user.id);

      if (!referenceId) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.ORGANIZATION_REFERENCE_ID_REQUIRED,
        );
      }

      const subscriptions = await ctx.context.adapter.findMany<Subscription>({
        model: "subscription",
        where: [{ field: "referenceId", value: referenceId }],
      });

      return ctx.json(subscriptions);
    },
  );
};

/**
 * POST /subscription/update
 *
 * Update an existing subscription (plan change, quantity, etc).
 */
export const updateSubscription = (options: RazorpayOptions) => {
  if (!options.subscription?.enabled) {
    throw new Error("Subscriptions must be enabled");
  }
  const subscriptionOptions = options.subscription;
  return createAuthEndpoint(
    "/subscription/update",
    {
      method: "POST",
      body: updateSubscriptionBodySchema,
      metadata: {
        openapi: {
          summary: "Update subscription",
          description: "Update a Razorpay subscription (plan, quantity, etc.)",
          responses: { 200: { description: "Subscription updated" } },
        },
      },
      use: [
        razorpaySessionMiddleware,
        referenceMiddleware(subscriptionOptions, "update-subscription"),
      ],
    },
    async (ctx) => {
      const session = ctx.context.session;
      const user = session.user as typeof session.user & WithRazorpayCustomerId;
      const customerType = ctx.body.customerType || "user";
      const referenceId =
        ctx.body.referenceId ||
        (customerType === "organization"
          ? session.session.activeOrganizationId
          : user.id);

      if (!referenceId) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.ORGANIZATION_REFERENCE_ID_REQUIRED,
        );
      }

      const subscription = await ctx.context.adapter.findOne<Subscription>({
        model: "subscription",
        where: [{ field: "referenceId", value: referenceId }],
      });

      if (!subscription?.razorpaySubscriptionId) {
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        );
      }

      try {
        const client = options.razorpayClient!;
        const updateParams: Record<string, unknown> = {};

        if (ctx.body.planId) updateParams.plan_id = ctx.body.planId;
        if (ctx.body.offerId) updateParams.offer_id = ctx.body.offerId;
        if (ctx.body.quantity !== undefined)
          updateParams.quantity = ctx.body.quantity;
        if (ctx.body.remainingCount !== undefined)
          updateParams.remaining_count = ctx.body.remainingCount;
        if (ctx.body.startAt !== undefined)
          updateParams.start_at = ctx.body.startAt;
        if (ctx.body.scheduleChangeAt)
          updateParams.schedule_change_at = ctx.body.scheduleChangeAt;
        if (ctx.body.customerNotify !== undefined)
          updateParams.customer_notify = ctx.body.customerNotify;

        const razorpaySub = await (client.subscriptions as any).update(
          subscription.razorpaySubscriptionId,
          updateParams,
        );

        const updated = await ctx.context.adapter.update<Subscription>({
          model: "subscription",
          update: {
            ...(ctx.body.planId ? { razorpayPlanId: ctx.body.planId } : {}),
            ...(ctx.body.quantity !== undefined
              ? { quantity: ctx.body.quantity }
              : {}),
            ...(ctx.body.metadata
              ? { metadata: JSON.stringify(ctx.body.metadata) }
              : {}),
            updatedAt: new Date(),
          },
          where: [{ field: "id", value: subscription.id }],
        });

        return ctx.json({
          subscription: updated || subscription,
          razorpaySubscription: razorpaySub,
        });
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to update subscription: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_UPDATE_FAILED,
        );
      }
    },
  );
};

/**
 * POST /subscription/restore
 *
 * Restore a subscription that was scheduled for cancellation at cycle end.
 */
export const restoreSubscription = (options: RazorpayOptions) => {
  if (!options.subscription?.enabled) {
    throw new Error("Subscriptions must be enabled");
  }
  const subscriptionOptions = options.subscription;
  return createAuthEndpoint(
    "/subscription/restore",
    {
      method: "POST",
      body: restoreSubscriptionBodySchema,
      metadata: {
        openapi: {
          summary: "Restore subscription",
          description:
            "Restore a subscription that was scheduled for cancellation at cycle end",
          responses: { 200: { description: "Subscription restored" } },
        },
      },
      use: [
        razorpaySessionMiddleware,
        referenceMiddleware(subscriptionOptions, "restore-subscription"),
      ],
    },
    async (ctx) => {
      const session = ctx.context.session;
      const user = session.user as typeof session.user & WithRazorpayCustomerId;
      const customerType = ctx.body.customerType || "user";
      const referenceId =
        ctx.body.referenceId ||
        (customerType === "organization"
          ? session.session.activeOrganizationId
          : user.id);

      if (!referenceId) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.ORGANIZATION_REFERENCE_ID_REQUIRED,
        );
      }

      const subscription = await ctx.context.adapter.findOne<Subscription>({
        model: "subscription",
        where: [{ field: "referenceId", value: referenceId }],
      });

      if (!subscription?.razorpaySubscriptionId) {
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        );
      }

      // Must be pending cancellation (cancelAtCycleEnd = true, still active)
      if (!subscription.cancelAtCycleEnd) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_PENDING_CANCEL,
        );
      }

      try {
        // Razorpay doesn't have a "restore" API — when cancelAtCycleEnd is used,
        // the subscription is still active on Razorpay until cycle end.
        // We clear the local pending cancellation flags.
        // If you need to re-activate on Razorpay side, you'd create a new subscription.
        const updated = await ctx.context.adapter.update<Subscription>({
          model: "subscription",
          update: {
            cancelAtCycleEnd: false,
            cancelledAt: null,
            updatedAt: new Date(),
          },
          where: [{ field: "id", value: subscription.id }],
        });

        return ctx.json({ subscription: updated || subscription });
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to restore subscription: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_RESTORE_FAILED,
        );
      }
    },
  );
};

/**
 * GET /subscription/get
 *
 * Fetch a single subscription by its local database ID.
 */
export const getSubscription = (options: RazorpayOptions) => {
  if (!options.subscription?.enabled) {
    throw new Error("Subscriptions must be enabled");
  }
  const subscriptionOptions = options.subscription;
  return createAuthEndpoint(
    "/subscription/get",
    {
      method: "GET",
      query: getSubscriptionQuerySchema,
      metadata: {
        openapi: {
          summary: "Get subscription",
          description: "Fetch a subscription by its local database ID",
          responses: { 200: { description: "Subscription details" } },
        },
      },
      use: [
        razorpaySessionMiddleware,
        referenceMiddleware(subscriptionOptions, "get-subscription"),
      ],
    },
    async (ctx) => {
      const subscription = await ctx.context.adapter.findOne<Subscription>({
        model: "subscription",
        where: [{ field: "id", value: ctx.query.subscriptionId }],
      });

      if (!subscription) {
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        );
      }

      return ctx.json(subscription);
    },
  );
};

// ─── Razorpay-Specific Endpoints ─────────────────────────────────────────────

/**
 * GET /razorpay/subscription/get
 *
 * Fetch a subscription by its Razorpay ID.
 */
export const fetchSubscription = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/subscription/get",
    {
      method: "GET",
      query: fetchSubscriptionQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch subscription",
          description: "Fetch a Razorpay subscription by ID",
          responses: { 200: { description: "Subscription details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const razorpaySub = await (client.subscriptions as any).fetch(
          ctx.query.subscriptionId,
        );
        return ctx.json(razorpaySub);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch subscription: ${error.message}`,
        );
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        );
      }
    },
  );
};

/**
 * POST /razorpay/subscription-link
 *
 * Create a subscription link for customer authorization.
 */
export const createSubscriptionLink = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/subscription-link",
    {
      method: "POST",
      body: subscriptionLinkBodySchema,
      metadata: {
        openapi: {
          summary: "Create subscription link",
          description: "Create a Razorpay subscription link",
          responses: { 200: { description: "Subscription link created" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const createParams: Record<string, unknown> = {
          plan_id: ctx.body.planId,
          total_count: ctx.body.totalCount,
          quantity: ctx.body.quantity ?? 1,
          customer_notify: ctx.body.customerNotify ?? true,
          notes: ctx.body.notes || {},
        };

        if (ctx.body.startAt !== undefined)
          createParams.start_at = ctx.body.startAt;
        if (ctx.body.expireBy !== undefined)
          createParams.expire_by = ctx.body.expireBy;
        if (ctx.body.addons !== undefined) createParams.addons = ctx.body.addons;
        if (ctx.body.offerId !== undefined)
          createParams.offer_id = ctx.body.offerId;
        if (ctx.body.notifyInfo !== undefined) {
          createParams.notify_info = {
            ...(ctx.body.notifyInfo.notifyPhone !== undefined
              ? { notify_phone: ctx.body.notifyInfo.notifyPhone }
              : {}),
            ...(ctx.body.notifyInfo.notifyEmail !== undefined
              ? { notify_email: ctx.body.notifyInfo.notifyEmail }
              : {}),
          };
        }

        const razorpaySub = await (client.subscriptions as any).create(
          createParams,
        );

        return ctx.json({
          subscriptionId: razorpaySub.id,
          shortUrl: razorpaySub.short_url,
          razorpaySubscription: razorpaySub,
        });
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to create subscription link: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_LINK_CREATE_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/subscription/pending-update
 *
 * Fetch pending update details for a subscription.
 */
export const fetchPendingUpdate = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/subscription/pending-update",
    {
      method: "GET",
      query: pendingUpdateQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch pending update",
          description: "Fetch details of a pending subscription update",
          responses: { 200: { description: "Pending update details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.subscriptions as any).pendingUpdate(
          ctx.query.subscriptionId,
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch pending update: ${error.message}`,
        );
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.PENDING_UPDATE_NOT_FOUND,
        );
      }
    },
  );
};

/**
 * POST /razorpay/subscription/cancel-update
 *
 * Cancel a pending subscription update.
 */
export const cancelPendingUpdate = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/subscription/cancel-update",
    {
      method: "POST",
      body: cancelUpdateBodySchema,
      metadata: {
        openapi: {
          summary: "Cancel pending update",
          description: "Cancel a pending subscription update",
          responses: { 200: { description: "Update cancelled" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (
          client.subscriptions as any
        ).cancelScheduledChanges(ctx.body.subscriptionId);
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to cancel pending update: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.PENDING_UPDATE_CANCEL_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/subscription/invoices
 *
 * Fetch all invoices for a subscription.
 */
export const fetchInvoices = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/subscription/invoices",
    {
      method: "GET",
      query: invoicesQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch invoices",
          description: "Fetch all invoices for a Razorpay subscription",
          responses: { 200: { description: "Invoice list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const invoices = await (client.invoices as any).all({
          subscription_id: ctx.query.subscriptionId,
        });
        return ctx.json(invoices);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to fetch invoices: ${error.message}`);
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.SUBSCRIPTION_INVOICE_FETCH_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/subscription/link-offer
 *
 * Link an offer to a subscription.
 */
export const linkOffer = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/subscription/link-offer",
    {
      method: "POST",
      body: linkOfferBodySchema,
      metadata: {
        openapi: {
          summary: "Link offer",
          description: "Link an offer to a Razorpay subscription",
          responses: { 200: { description: "Offer linked" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.subscriptions as any).update(
          ctx.body.subscriptionId,
          { offer_id: ctx.body.offerId },
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to link offer: ${error.message}`);
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.OFFER_LINK_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/subscription/delete-offer
 *
 * Delete/unlink an offer from a subscription.
 */
export const deleteOffer = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/subscription/delete-offer",
    {
      method: "POST",
      body: deleteOfferBodySchema,
      metadata: {
        openapi: {
          summary: "Delete offer",
          description: "Remove an offer from a Razorpay subscription",
          responses: { 200: { description: "Offer deleted" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.subscriptions as any).deleteOffer(
          ctx.body.subscriptionId,
          ctx.body.offerId,
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to delete offer: ${error.message}`);
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.OFFER_DELETE_FAILED,
        );
      }
    },
  );
};

// ─── Plan Endpoints ──────────────────────────────────────────────────────────

/**
 * POST /razorpay/plan/create
 *
 * Create a new Razorpay plan.
 */
export const createPlan = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/plan/create",
    {
      method: "POST",
      body: createPlanBodySchema,
      metadata: {
        openapi: {
          summary: "Create plan",
          description: "Create a new Razorpay plan",
          responses: { 200: { description: "Plan created" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const plan = await (client.plans as any).create({
          period: ctx.body.period,
          interval: ctx.body.interval,
          item: {
            name: ctx.body.itemName,
            amount: ctx.body.itemAmount,
            currency: ctx.body.itemCurrency,
            description: ctx.body.itemDescription,
          },
          notes: ctx.body.notes || {},
        });
        return ctx.json(plan);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to create plan: ${error.message}`);
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.PLAN_CREATE_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/plan/list
 *
 * Fetch all Razorpay plans.
 */
export const listPlans = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/plan/list",
    {
      method: "GET",
      metadata: {
        openapi: {
          summary: "List plans",
          description: "Fetch all Razorpay plans",
          responses: { 200: { description: "Plans list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const plans = await (client.plans as any).all();
        return ctx.json(plans);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to list plans: ${error.message}`);
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.FAILED_TO_FETCH_PLANS,
        );
      }
    },
  );
};

/**
 * GET /razorpay/plan/get
 *
 * Fetch a Razorpay plan by ID.
 */
export const fetchPlan = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/plan/get",
    {
      method: "GET",
      query: fetchPlanQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch plan",
          description: "Fetch a Razorpay plan by ID",
          responses: { 200: { description: "Plan details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const plan = await (client.plans as any).fetch(ctx.query.planId);
        return ctx.json(plan);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to fetch plan: ${error.message}`);
        throw createAPIError("NOT_FOUND", RAZORPAY_ERROR_CODES.PLAN_NOT_FOUND);
      }
    },
  );
};

// ─── Customer Endpoints ──────────────────────────────────────────────────────

/**
 * POST /razorpay/customer/create
 *
 * Create a new Razorpay customer.
 */
export const createCustomer = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/create",
    {
      method: "POST",
      body: createCustomerBodySchema,
      metadata: {
        openapi: {
          summary: "Create customer",
          description: "Create a new Razorpay customer",
          responses: { 200: { description: "Customer created" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const customer = await (client.customers as any).create({
          name: ctx.body.name,
          email: ctx.body.email,
          contact: ctx.body.contact,
          fail_existing: ctx.body.failExisting ? "1" : "0",
          gstin: ctx.body.gstin,
          notes: ctx.body.notes || {},
        });
        return ctx.json(customer);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to create customer: ${error.message}`);
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.UNABLE_TO_CREATE_CUSTOMER,
        );
      }
    },
  );
};

/**
 * POST /razorpay/customer/edit
 *
 * Edit a Razorpay customer.
 */
export const editCustomer = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/edit",
    {
      method: "POST",
      body: editCustomerBodySchema,
      metadata: {
        openapi: {
          summary: "Edit customer",
          description: "Edit a Razorpay customer",
          responses: { 200: { description: "Customer updated" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const updateParams: Record<string, unknown> = {};
        if (ctx.body.name) updateParams.name = ctx.body.name;
        if (ctx.body.email) updateParams.email = ctx.body.email;
        if (ctx.body.contact) updateParams.contact = ctx.body.contact;
        if (ctx.body.gstin) updateParams.gstin = ctx.body.gstin;
        if (ctx.body.notes) updateParams.notes = ctx.body.notes;

        const customer = await (client.customers as any).edit(
          ctx.body.customerId,
          updateParams,
        );
        return ctx.json(customer);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to edit customer: ${error.message}`);
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.CUSTOMER_EDIT_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/customer/list
 *
 * Fetch all Razorpay customers.
 */
export const listCustomers = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/list",
    {
      method: "GET",
      metadata: {
        openapi: {
          summary: "List customers",
          description: "Fetch all Razorpay customers",
          responses: { 200: { description: "Customers list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const customers = await (client.customers as any).all();
        return ctx.json(customers);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to list customers: ${error.message}`);
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.CUSTOMER_NOT_FOUND,
        );
      }
    },
  );
};

/**
 * GET /razorpay/customer/get
 *
 * Fetch a Razorpay customer by ID.
 */
export const fetchCustomer = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/get",
    {
      method: "GET",
      query: fetchCustomerQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch customer",
          description: "Fetch a Razorpay customer by ID",
          responses: { 200: { description: "Customer details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const customer = await (client.customers as any).fetch(
          ctx.query.customerId,
        );
        return ctx.json(customer);
      } catch (error: any) {
        ctx.context.logger.error(`Failed to fetch customer: ${error.message}`);
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.CUSTOMER_NOT_FOUND,
        );
      }
    },
  );
};

// ─── Refund Endpoints ──────────────────────────────────────────────────────────

/**
 * GET /razorpay/refund/get
 * Fetch a single refund by ID.
 */
export const fetchRefund = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/refund/get",
    {
      method: "GET",
      query: fetchRefundQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch refund",
          description: "Fetch a Razorpay refund by ID",
          responses: { 200: { description: "Refund details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {};
        if (ctx.query.paymentId) params.payment_id = ctx.query.paymentId;
        const refund = await (client.refunds as any).fetch(
          ctx.query.refundId,
          params,
        );
        return ctx.json(serializeRazorpayRefund(refund as never));
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch refund: ${error.message}`,
        );
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.REFUND_NOT_FOUND,
        );
      }
    },
  );
};

/**
 * GET /razorpay/refund/list
 * Fetch all refunds with pagination.
 */
export const fetchAllRefunds = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/refund/list",
    {
      method: "GET",
      query: fetchAllRefundsQuerySchema,
      metadata: {
        openapi: {
          summary: "List refunds",
          description: "Fetch all refunds from Razorpay",
          responses: { 200: { description: "Refund list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {};
        if (ctx.query.from) params.from = ctx.query.from;
        if (ctx.query.to) params.to = ctx.query.to;
        if (ctx.query.count) params.count = ctx.query.count;
        if (ctx.query.skip) params.skip = ctx.query.skip;
        const refunds = await (client.refunds as any).all(params);
        return ctx.json(serializeRazorpayRefundList(refunds as never));
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to list refunds: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.REFUND_LIST_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/refund/edit
 * Edit notes on an existing refund.
 */
export const editRefund = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/refund/edit",
    {
      method: "POST",
      body: editRefundBodySchema,
      metadata: {
        openapi: {
          summary: "Edit refund",
          description: "Edit notes on a Razorpay refund",
          responses: { 200: { description: "Refund updated" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const refund = await (client.refunds as any).edit(
          ctx.body.refundId,
          { notes: sanitizeRazorpayNotes(ctx.body.notes) },
        );
        return ctx.json(serializeRazorpayRefund(refund as never));
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to edit refund: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.REFUND_EDIT_FAILED,
        );
      }
    },
  );
};

// ─── Invoice Endpoints ────────────────────────────────────────────────────────

/**
 * POST /razorpay/invoice/create
 * Create a standalone Razorpay invoice.
 */
export const createInvoice = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/invoice/create",
    {
      method: "POST",
      body: createInvoiceBodySchema,
      metadata: {
        openapi: {
          summary: "Create invoice",
          description: "Create a standalone Razorpay invoice",
          responses: { 200: { description: "Invoice created" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {
          line_items: ctx.body.line_items,
        };
        if (ctx.body.type) params.type = ctx.body.type;
        if (ctx.body.description !== undefined)
          params.description = ctx.body.description;
        if (ctx.body.date !== undefined) params.date = ctx.body.date;
        if (ctx.body.customer_id) params.customer_id = ctx.body.customer_id;
        if (ctx.body.currency) params.currency = ctx.body.currency;
        if (ctx.body.customer !== undefined)
          params.customer = ctx.body.customer;
        if (ctx.body.order_id) params.order_id = ctx.body.order_id;
        if (ctx.body.expire_by !== undefined)
          params.expire_by = ctx.body.expire_by;
        if (ctx.body.sms_notify !== undefined)
          params.sms_notify = ctx.body.sms_notify;
        if (ctx.body.email_notify !== undefined)
          params.email_notify = ctx.body.email_notify;
        if (ctx.body.partial_payment !== undefined)
          params.partial_payment = ctx.body.partial_payment;
        if (ctx.body.notes) params.notes = sanitizeRazorpayNotes(ctx.body.notes);
        if (ctx.body.receipt !== undefined)
          params.receipt = ctx.body.receipt;
        if (ctx.body.amount !== undefined) params.amount = ctx.body.amount;

        const invoice = await (client.invoices as any).create(params);
        return ctx.json(invoice);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to create invoice: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.INVOICE_CREATE_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/invoice/get
 * Fetch a single invoice by ID.
 */
export const fetchInvoice = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/invoice/get",
    {
      method: "GET",
      query: fetchInvoiceQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch invoice",
          description: "Fetch a Razorpay invoice by ID",
          responses: { 200: { description: "Invoice details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const invoice = await (client.invoices as any).fetch(
          ctx.query.invoiceId,
        );
        return ctx.json(invoice);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch invoice: ${error.message}`,
        );
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.INVOICE_NOT_FOUND,
        );
      }
    },
  );
};

/**
 * POST /razorpay/invoice/edit
 * Edit an existing invoice's fields.
 */
export const editInvoice = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/invoice/edit",
    {
      method: "POST",
      body: editInvoiceBodySchema,
      metadata: {
        openapi: {
          summary: "Edit invoice",
          description: "Edit a Razorpay invoice",
          responses: { 200: { description: "Invoice updated" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      const params: Record<string, unknown> = {};
      if (ctx.body.notes) params.notes = sanitizeRazorpayNotes(ctx.body.notes);
      if (ctx.body.customer_details !== undefined)
        params.customer_details = ctx.body.customer_details;
      if (ctx.body.line_items !== undefined)
        params.line_items = ctx.body.line_items;
      if (ctx.body.expire_by !== undefined)
        params.expire_by = ctx.body.expire_by;
      if (ctx.body.sms_notify !== undefined)
        params.sms_notify = ctx.body.sms_notify;
      if (ctx.body.email_notify !== undefined)
        params.email_notify = ctx.body.email_notify;
      if (ctx.body.partial_payment !== undefined)
        params.partial_payment = ctx.body.partial_payment;
      if (ctx.body.receipt !== undefined)
        params.receipt = ctx.body.receipt;

      try {
        const client = options.razorpayClient!;
        const invoice = await (client.invoices as any).edit(
          ctx.body.invoiceId,
          params,
        );
        return ctx.json(invoice);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to edit invoice: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.INVOICE_EDIT_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/invoice/list
 * Fetch all invoices with optional filters and pagination.
 */
export const fetchAllInvoices = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/invoice/list",
    {
      method: "GET",
      query: fetchAllInvoicesQuerySchema,
      metadata: {
        openapi: {
          summary: "List invoices",
          description: "Fetch all invoices from Razorpay with optional filters",
          responses: { 200: { description: "Invoice list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {};
        if (ctx.query.from) params.from = ctx.query.from;
        if (ctx.query.to) params.to = ctx.query.to;
        if (ctx.query.count) params.count = ctx.query.count;
        if (ctx.query.skip) params.skip = ctx.query.skip;
        if (ctx.query.type) params.type = ctx.query.type;
        if (ctx.query.payment_id) params.payment_id = ctx.query.payment_id;
        if (ctx.query.receipt) params.receipt = ctx.query.receipt;
        if (ctx.query.customer_id) params.customer_id = ctx.query.customer_id;
        if (ctx.query.subscription_id)
          params.subscription_id = ctx.query.subscription_id;
        const invoices = await (client.invoices as any).all(params);
        return ctx.json(invoices);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to list invoices: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.INVOICE_LIST_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/invoice/issue
 * Issue a draft invoice.
 */
export const issueInvoice = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/invoice/issue",
    {
      method: "POST",
      body: issueInvoiceQuerySchema,
      metadata: {
        openapi: {
          summary: "Issue invoice",
          description: "Issue a draft Razorpay invoice",
          responses: { 200: { description: "Invoice issued" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const invoice = await (client.invoices as any).issue(
          ctx.body.invoiceId,
        );
        return ctx.json(invoice);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to issue invoice: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.INVOICE_ISSUE_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/invoice/delete
 * Delete a draft invoice.
 */
export const deleteInvoice = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/invoice/delete",
    {
      method: "POST",
      body: deleteInvoiceQuerySchema,
      metadata: {
        openapi: {
          summary: "Delete invoice",
          description: "Delete a draft Razorpay invoice",
          responses: { 200: { description: "Invoice deleted" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        await (client.invoices as any).delete(ctx.body.invoiceId);
        return ctx.json({ deleted: true });
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to delete invoice: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.INVOICE_DELETE_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/invoice/cancel
 * Cancel an issued invoice.
 */
export const cancelInvoice = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/invoice/cancel",
    {
      method: "POST",
      body: cancelInvoiceQuerySchema,
      metadata: {
        openapi: {
          summary: "Cancel invoice",
          description: "Cancel an issued Razorpay invoice",
          responses: { 200: { description: "Invoice cancelled" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const invoice = await (client.invoices as any).cancel(
          ctx.body.invoiceId,
        );
        return ctx.json(invoice);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to cancel invoice: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.INVOICE_CANCEL_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/invoice/notify
 * Send an invoice notification (SMS or email).
 */
export const notifyByInvoice = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/invoice/notify",
    {
      method: "POST",
      body: notifyByInvoiceBodySchema,
      metadata: {
        openapi: {
          summary: "Notify by invoice",
          description: "Send SMS or email notification for an invoice",
          responses: { 200: { description: "Notification sent" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.invoices as any).notifyBy(
          ctx.body.invoiceId,
          ctx.body.medium,
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to send invoice notification: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.INVOICE_NOTIFY_FAILED,
        );
      }
    },
  );
};

// ─── Order Endpoints ──────────────────────────────────────────────────────────

/**
 * POST /razorpay/order/edit
 * Edit notes on an existing order.
 */
export const editOrder = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/order/edit",
    {
      method: "POST",
      body: editOrderBodySchema,
      metadata: {
        openapi: {
          summary: "Edit order",
          description: "Edit notes on a Razorpay order",
          responses: { 200: { description: "Order updated" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const order = await (client.orders as any).edit(ctx.body.orderId, {
          notes: sanitizeRazorpayNotes(ctx.body.notes),
        });
        return ctx.json(order);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to edit order: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ORDER_EDIT_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/order/payments
 * Fetch all payments for a given order.
 */
export const fetchPaymentsForOrder = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/order/payments",
    {
      method: "GET",
      query: fetchPaymentsForOrderQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch payments for order",
          description: "Fetch all payments associated with a Razorpay order",
          responses: { 200: { description: "Payment list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const payments = await (client.orders as any).fetchPayments(
          ctx.query.orderId,
        );
        return ctx.json(
          serializeRazorpayPaymentListForOrder(payments as never),
        );
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch payments for order: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ORDER_PAYMENTS_FETCH_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/order/list
 * Fetch all orders with optional filters and pagination.
 */
export const fetchAllOrders = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/order/list",
    {
      method: "GET",
      query: fetchAllOrdersQuerySchema,
      metadata: {
        openapi: {
          summary: "List orders",
          description: "Fetch all orders from Razorpay with optional filters",
          responses: { 200: { description: "Order list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {};
        if (ctx.query.from) params.from = ctx.query.from;
        if (ctx.query.to) params.to = ctx.query.to;
        if (ctx.query.count) params.count = ctx.query.count;
        if (ctx.query.skip) params.skip = ctx.query.skip;
        if (ctx.query.authorized !== undefined)
          params.authorized = ctx.query.authorized ? 1 : 0;
        if (ctx.query.receipt) params.receipt = ctx.query.receipt;
        if (ctx.query.expand) params["expand[]"] = ctx.query.expand;
        const orders = await (client.orders as any).all(params);
        return ctx.json(serializeRazorpayOrderList(orders as never));
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to list orders: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ORDER_LIST_FAILED,
        );
      }
    },
  );
};

// ─── Payment Endpoints (beyond one-time) ──────────────────────────────────────

/**
 * GET /razorpay/payment/list
 * Fetch all payments with optional filters and pagination.
 */
export const fetchAllPayments = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/payment/list",
    {
      method: "GET",
      query: fetchAllPaymentsQuerySchema,
      metadata: {
        openapi: {
          summary: "List payments",
          description: "Fetch all payments from Razorpay with optional filters",
          responses: { 200: { description: "Payment list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {};
        if (ctx.query.from) params.from = ctx.query.from;
        if (ctx.query.to) params.to = ctx.query.to;
        if (ctx.query.count) params.count = ctx.query.count;
        if (ctx.query.skip) params.skip = ctx.query.skip;
        if (ctx.query.expand) params["expand[]"] = ctx.query.expand;
        if (ctx.query.reference_id)
          params.reference_id = ctx.query.reference_id;
        if (ctx.query.transfer !== undefined)
          params.transfer = ctx.query.transfer;
        const payments = await (client.payments as any).all(params);
        return ctx.json(serializeRazorpayPaymentList(payments as never));
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to list payments: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.PAYMENT_LIST_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/payment/edit
 * Edit notes on an existing payment.
 */
export const editPayment = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/payment/edit",
    {
      method: "POST",
      body: editPaymentBodySchema,
      metadata: {
        openapi: {
          summary: "Edit payment",
          description: "Edit notes on a Razorpay payment",
          responses: { 200: { description: "Payment updated" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const payment = await (client.payments as any).edit(
          ctx.body.paymentId,
          { notes: sanitizeRazorpayNotes(ctx.body.notes) },
        );
        return ctx.json(serializeRazorpayPayment(payment as never));
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to edit payment: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.PAYMENT_EDIT_FAILED,
        );
      }
    },
  );
};

// ─── Customer Bank Account Endpoints ──────────────────────────────────────────

/**
 * POST /razorpay/customer/bank-account
 * Add a bank account to a customer.
 */
export const addBankAccount = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/bank-account",
    {
      method: "POST",
      body: addBankAccountBodySchema,
      metadata: {
        openapi: {
          summary: "Add bank account",
          description: "Add a bank account to a Razorpay customer",
          responses: { 200: { description: "Bank account added" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.customers as any).addBankAccount(
          ctx.body.customerId,
          {
            ifsc_code: ctx.body.ifsc_code,
            account_number: ctx.body.account_number,
            ...(ctx.body.beneficiary_name
              ? { beneficiary_name: ctx.body.beneficiary_name }
              : {}),
          },
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to add bank account: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.BANK_ACCOUNT_ADD_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/customer/bank-account/delete
 * Delete a bank account from a customer.
 */
export const deleteBankAccount = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/bank-account/delete",
    {
      method: "POST",
      body: deleteBankAccountQuerySchema,
      metadata: {
        openapi: {
          summary: "Delete bank account",
          description: "Delete a bank account from a Razorpay customer",
          responses: { 200: { description: "Bank account deleted" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.customers as any).deleteBankAccount(
          ctx.body.customerId,
          ctx.body.bankAccountId,
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to delete bank account: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.BANK_ACCOUNT_DELETE_FAILED,
        );
      }
    },
  );
};

// ─── Customer Token Endpoints ────────────────────────────────────────────────

/**
 * GET /razorpay/customer/tokens
 * Fetch all saved tokens for a customer.
 */
export const fetchTokens = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/tokens",
    {
      method: "GET",
      query: fetchTokensQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch tokens",
          description: "Fetch all saved payment tokens for a Razorpay customer",
          responses: { 200: { description: "Token list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const tokens = await (client.customers as any).fetchTokens(
          ctx.query.customerId,
        );
        return ctx.json(tokens);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch tokens: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.TOKEN_FETCH_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/customer/token
 * Fetch a specific saved token for a customer.
 */
export const fetchToken = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/token",
    {
      method: "GET",
      query: fetchTokenQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch token",
          description: "Fetch a specific payment token for a Razorpay customer",
          responses: { 200: { description: "Token details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const token = await (client.customers as any).fetchToken(
          ctx.query.customerId,
          ctx.query.tokenId,
        );
        return ctx.json(token);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch token: ${error.message}`,
        );
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.TOKEN_FETCH_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/customer/token/delete
 * Delete a saved token for a customer.
 */
export const deleteToken = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/customer/token/delete",
    {
      method: "POST",
      body: deleteTokenQuerySchema,
      metadata: {
        openapi: {
          summary: "Delete token",
          description: "Delete a saved payment token for a Razorpay customer",
          responses: { 200: { description: "Token deleted" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.customers as any).deleteToken(
          ctx.body.customerId,
          ctx.body.tokenId,
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to delete token: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.TOKEN_DELETE_FAILED,
        );
      }
    },
  );
};

// ─── Subscriptions: Create Add-on ─────────────────────────────────────────────

/**
 * POST /razorpay/subscription/addon
 * Create an add-on for a subscription.
 */
export const createSubscriptionAddon = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/subscription/addon",
    {
      method: "POST",
      body: createSubscriptionAddonBodySchema,
      metadata: {
        openapi: {
          summary: "Create subscription add-on",
          description: "Create an add-on for a Razorpay subscription",
          responses: { 200: { description: "Add-on created" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.subscriptions as any).createAddon(
          ctx.body.subscriptionId,
          {
            item: ctx.body.item,
            ...(ctx.body.quantity ? { quantity: ctx.body.quantity } : {}),
          },
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to create subscription add-on: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ADDON_CREATE_FAILED,
        );
      }
    },
  );
};

// ─── Add-on Endpoints (standalone) ────────────────────────────────────────────

/**
 * GET /razorpay/addon/get
 * Fetch a single add-on by ID.
 */
export const fetchAddon = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/addon/get",
    {
      method: "GET",
      query: fetchAddonQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch add-on",
          description: "Fetch a Razorpay add-on by ID",
          responses: { 200: { description: "Add-on details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const addon = await (client.addons as any).fetch(ctx.query.addonId);
        return ctx.json(addon);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch add-on: ${error.message}`,
        );
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.ADDON_NOT_FOUND,
        );
      }
    },
  );
};

/**
 * GET /razorpay/addon/list
 * Fetch all add-ons with pagination.
 */
export const listAddons = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/addon/list",
    {
      method: "GET",
      query: fetchAllAddonsQuerySchema,
      metadata: {
        openapi: {
          summary: "List add-ons",
          description: "Fetch all add-ons from Razorpay",
          responses: { 200: { description: "Add-on list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {};
        if (ctx.query.from) params.from = ctx.query.from;
        if (ctx.query.to) params.to = ctx.query.to;
        if (ctx.query.count) params.count = ctx.query.count;
        if (ctx.query.skip) params.skip = ctx.query.skip;
        const addons = await (client.addons as any).all(params);
        return ctx.json(addons);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to list add-ons: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ADDON_LIST_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/addon/delete
 * Delete an add-on by ID.
 */
export const deleteAddon = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/addon/delete",
    {
      method: "POST",
      body: deleteAddonQuerySchema,
      metadata: {
        openapi: {
          summary: "Delete add-on",
          description: "Delete a Razorpay add-on by ID",
          responses: { 200: { description: "Add-on deleted" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.addons as any).delete(
          ctx.body.addonId,
        );
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to delete add-on: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ADDON_DELETE_FAILED,
        );
      }
    },
  );
};

// ─── Item Endpoints ───────────────────────────────────────────────────────────

/**
 * POST /razorpay/item/create
 * Create a new item.
 */
export const createItem = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/item/create",
    {
      method: "POST",
      body: createItemBodySchema,
      metadata: {
        openapi: {
          summary: "Create item",
          description: "Create a new Razorpay item",
          responses: { 200: { description: "Item created" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {
          name: ctx.body.name,
          amount: ctx.body.amount,
          currency: ctx.body.currency,
        };
        if (ctx.body.description !== undefined)
          params.description = ctx.body.description;
        if (ctx.body.active !== undefined) params.active = ctx.body.active;
        if (ctx.body.tax_inclusive !== undefined)
          params.tax_inclusive = ctx.body.tax_inclusive;
        if (ctx.body.hsn_code !== undefined)
          params.hsn_code = ctx.body.hsn_code;
        if (ctx.body.sac_code !== undefined)
          params.sac_code = ctx.body.sac_code;
        if (ctx.body.tax_rate !== undefined)
          params.tax_rate = ctx.body.tax_rate;
        if (ctx.body.tax_id !== undefined) params.tax_id = ctx.body.tax_id;
        if (ctx.body.tax_group_id !== undefined)
          params.tax_group_id = ctx.body.tax_group_id;

        const item = await (client.items as any).create(params);
        return ctx.json(item);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to create item: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ITEM_CREATE_FAILED,
        );
      }
    },
  );
};

/**
 * GET /razorpay/item/get
 * Fetch a single item by ID.
 */
export const fetchItem = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/item/get",
    {
      method: "GET",
      query: fetchItemQuerySchema,
      metadata: {
        openapi: {
          summary: "Fetch item",
          description: "Fetch a Razorpay item by ID",
          responses: { 200: { description: "Item details" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const item = await (client.items as any).fetch(ctx.query.itemId);
        return ctx.json(item);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to fetch item: ${error.message}`,
        );
        throw createAPIError(
          "NOT_FOUND",
          RAZORPAY_ERROR_CODES.ITEM_NOT_FOUND,
        );
      }
    },
  );
};

/**
 * GET /razorpay/item/list
 * Fetch all items with pagination.
 */
export const listItems = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/item/list",
    {
      method: "GET",
      query: fetchAllItemsQuerySchema,
      metadata: {
        openapi: {
          summary: "List items",
          description: "Fetch all items from Razorpay",
          responses: { 200: { description: "Item list" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const params: Record<string, unknown> = {};
        if (ctx.query.from) params.from = ctx.query.from;
        if (ctx.query.to) params.to = ctx.query.to;
        if (ctx.query.count) params.count = ctx.query.count;
        if (ctx.query.skip) params.skip = ctx.query.skip;
        if (ctx.query.active !== undefined) params.active = ctx.query.active;
        const items = await (client.items as any).all(params);
        return ctx.json(items);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to list items: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ITEM_LIST_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/item/edit
 * Edit an existing item.
 */
export const editItem = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/item/edit",
    {
      method: "POST",
      body: editItemBodySchema,
      metadata: {
        openapi: {
          summary: "Edit item",
          description: "Edit a Razorpay item",
          responses: { 200: { description: "Item updated" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      const params: Record<string, unknown> = {};
      if (ctx.body.name !== undefined) params.name = ctx.body.name;
      if (ctx.body.amount !== undefined) params.amount = ctx.body.amount;
      if (ctx.body.currency !== undefined) params.currency = ctx.body.currency;
      if (ctx.body.description !== undefined)
        params.description = ctx.body.description;
      if (ctx.body.active !== undefined) params.active = ctx.body.active;
      if (ctx.body.tax_inclusive !== undefined)
        params.tax_inclusive = ctx.body.tax_inclusive;
      if (ctx.body.hsn_code !== undefined)
        params.hsn_code = ctx.body.hsn_code;
      if (ctx.body.sac_code !== undefined)
        params.sac_code = ctx.body.sac_code;
      if (ctx.body.tax_rate !== undefined)
        params.tax_rate = ctx.body.tax_rate;
      if (ctx.body.tax_id !== undefined) params.tax_id = ctx.body.tax_id;
      if (ctx.body.tax_group_id !== undefined)
        params.tax_group_id = ctx.body.tax_group_id;

      try {
        const client = options.razorpayClient!;
        const item = await (client.items as any).edit(
          ctx.body.itemId,
          params,
        );
        return ctx.json(item);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to edit item: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ITEM_EDIT_FAILED,
        );
      }
    },
  );
};

/**
 * POST /razorpay/item/delete
 * Delete an item by ID.
 */
export const deleteItem = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/item/delete",
    {
      method: "POST",
      body: deleteItemQuerySchema,
      metadata: {
        openapi: {
          summary: "Delete item",
          description: "Delete a Razorpay item by ID",
          responses: { 200: { description: "Item deleted" } },
        },
      },
      use: [razorpaySessionMiddleware],
    },
    async (ctx) => {
      try {
        const client = options.razorpayClient!;
        const result = await (client.items as any).delete(ctx.body.itemId);
        return ctx.json(result);
      } catch (error: any) {
        ctx.context.logger.error(
          `Failed to delete item: ${error.message}`,
        );
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.ITEM_DELETE_FAILED,
        );
      }
    },
  );
};


/**
 * POST /razorpay/webhook
 *
 * Handle Razorpay webhook events.
 * Verifies HMAC-SHA256 signature before processing.
 */
export const razorpayWebhook = (options: RazorpayOptions) => {
  return createAuthEndpoint(
    "/razorpay/webhook",
    {
      method: "POST",
      metadata: {
        isAction: false,
        openapi: {
          summary: "Razorpay webhook handler",
          description:
            "Handles incoming Razorpay webhook events with HMAC-SHA256 signature verification",
          responses: {
            200: { description: "Webhook processed" },
          },
        },
      },
    },
    async (ctx) => {
      const webhookSecret = options.razorpayWebhookSecret;
      if (!webhookSecret) {
        throw createAPIError(
          "INTERNAL_SERVER_ERROR",
          RAZORPAY_ERROR_CODES.WEBHOOK_SECRET_NOT_FOUND,
        );
      }

      // Get signature from header
      const signature = ctx.request?.headers?.get("x-razorpay-signature");
      if (!signature) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.WEBHOOK_SIGNATURE_NOT_FOUND,
        );
      }

      // Get raw body
      let rawBody: string;
      try {
        if (!ctx.request) {
          throw new Error("Request is unavailable");
        }
        rawBody = await ctx.request!.text();
      } catch {
        throw createAPIError("BAD_REQUEST", RAZORPAY_ERROR_CODES.WEBHOOK_ERROR);
      }

      if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
        throw createAPIError(
          "BAD_REQUEST",
          RAZORPAY_ERROR_CODES.FAILED_TO_VERIFY_WEBHOOK,
        );
      }

      let event: RazorpayWebhookEvent;
      try {
        event = JSON.parse(rawBody) as RazorpayWebhookEvent;
      } catch {
        throw createAPIError("BAD_REQUEST", RAZORPAY_ERROR_CODES.WEBHOOK_ERROR);
      }

      // Call optional generic event handler
      await options.onEvent?.(event);

      // Route to specific handler
      switch (event.event) {
        case "subscription.authenticated":
          await onSubscriptionAuthenticated(ctx, options, event);
          break;
        case "subscription.activated":
          await onSubscriptionActivated(ctx, options, event);
          break;
        case "subscription.charged":
          await onSubscriptionCharged(ctx, options, event);
          break;
        case "subscription.pending":
          await onSubscriptionPending(ctx, options, event);
          break;
        case "subscription.halted":
          await onSubscriptionHalted(ctx, options, event);
          break;
        case "subscription.completed":
          await onSubscriptionCompleted(ctx, options, event);
          break;
        case "subscription.updated":
          await onSubscriptionUpdated(ctx, options, event);
          break;
        case "subscription.paused":
          await onSubscriptionPaused(ctx, options, event);
          break;
        case "subscription.resumed":
          await onSubscriptionResumed(ctx, options, event);
          break;
        case "subscription.cancelled":
          await onSubscriptionCancelled(ctx, options, event);
          break;
        case "payment.authorized":
          await onPaymentAuthorized(ctx, options, event);
          break;
        case "payment.captured":
          await onPaymentCaptured(ctx, options, event);
          break;
        case "payment.failed":
          await onPaymentFailed(ctx, options, event);
          break;
        case "order.paid":
          await onOrderPaid(ctx, options, event);
          break;
        case "refund.created":
          await onRefundCreated(ctx, options, event);
          break;
        case "refund.processed":
          await onRefundProcessed(ctx, options, event);
          break;
        case "refund.failed":
          await onRefundFailed(ctx, options, event);
          break;
        case "invoice.partially_paid":
          await onInvoicePartiallyPaid(ctx, options, event);
          break;
        case "invoice.paid":
          await onInvoicePaid(ctx, options, event);
          break;
        case "invoice.expired":
          await onInvoiceExpired(ctx, options, event);
          break;
        default:
          ctx.context.logger.info(
            `Razorpay webhook: Unhandled event type: ${event.event}`,
          );
      }

      return ctx.json({ received: true });
    },
  );
};
