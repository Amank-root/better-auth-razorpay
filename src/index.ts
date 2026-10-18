import type { BetterAuthPlugin, User } from "better-auth";
import type { Organization } from "better-auth/plugins/organization";
import Razorpay from "razorpay";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import * as z from "zod";
import { RAZORPAY_ERROR_CODES } from "./error-codes";
import { customerNotes } from "./metadata";
import { sanitizeRazorpayNotes } from "./notes";
import {
    serializeRazorpayPayment,
    serializeRazorpayRefund,
    serializeRazorpayOrder,
    toRazorpayOrderInput,
} from "./razorpay";
import {
    cancelPendingUpdate,
    cancelSubscription,
    cancelInvoice,
    createCustomer,
    createInvoice,
    createItem,
    createPlan,
    createSubscriptionAddon,
    createSubscriptionLink,
    deleteAddon,
    deleteInvoice,
    deleteItem,
    deleteOffer,
    deleteToken,
    editCustomer,
    editInvoice,
    editItem,
    editOrder,
    editPayment,
    editRefund,
    fetchAddon,
    fetchAllInvoices,
    fetchAllOrders,
    fetchAllPayments,
    fetchAllRefunds,
    fetchAllSubscriptions,
    fetchCustomer,
    fetchInvoice,
    fetchInvoices,
    fetchItem,
    fetchPaymentsForOrder,
    fetchPlan,
    fetchPendingUpdate,
    fetchRefund,
    fetchSubscription,
    fetchTokens,
    fetchToken,
    getSubscription,
    addBankAccount,
    deleteBankAccount,
    issueInvoice,
    listAddons,
    listItems,
    linkOffer,
    listCustomers,
    listPlans,
    listSubscriptions,
    notifyByInvoice,
    pauseSubscription,
    razorpayWebhook,
    restoreSubscription,
    resumeSubscription,
    updateSubscription,
    upgradeSubscription,
} from "./routes";
import { getSchema } from "./schema";
import { verifyRazorpayPaymentSignature } from "./signature";
import type {
    CreateRazorpayOrderInput,
    RazorpayOptions,
    Subscription,
    WithRazorpayCustomerId,
} from "./types";
import { createAPIError, getPlans, isActive } from "./utils";
import { PACKAGE_VERSION } from "./version";

export { RAZORPAY_ERROR_CODES } from "./error-codes";
export {
  createRazorpayPaymentSignature,
  createRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "./signature";
export type {
  CreateRazorpayOrderInput,
  RazorpayNotes,
  RazorpayOrderResponse,
  RazorpayOrderListResponse,
  RazorpayPaymentResponse,
  RazorpayPaymentListResponse,
  RazorpayPaymentListForOrderResponse,
  RazorpayPluginOptions,
  RazorpayRefundResponse,
  RazorpayRefundListResponse,
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
  RazorpayPaymentEntity,
  RazorpayRefundEntity,
  RazorpayInvoiceEntity,
  RazorpayOrderEntity,
  RazorpayDisputeEntity,
  RazorpayItemEntity,
  RazorpayAddonEntity,
  FetchRefundQuery,
  FetchAllRefundsQuery,
  EditRefundBody,
  CreateInvoiceBody,
  FetchInvoiceQuery,
  EditInvoiceBody,
  FetchAllInvoicesQuery,
  IssueInvoiceQuery,
  DeleteInvoiceQuery,
  CancelInvoiceQuery,
  NotifyByInvoiceBody,
  EditOrderBody,
  FetchPaymentsForOrderQuery,
  FetchAllOrdersQuery,
  EditPaymentBody,
  FetchAllPaymentsQuery,
  AddBankAccountBody,
  DeleteBankAccountQuery,
  FetchTokensQuery,
  FetchTokenQuery,
  DeleteTokenQuery,
  CreateSubscriptionAddonBody,
  FetchAddonQuery,
  DeleteAddonQuery,
  FetchAllAddonsQuery,
  CreateItemBody,
  FetchItemQuery,
  EditItemBody,
  DeleteItemQuery,
  FetchAllItemsQuery,
  FetchAllSubscriptionsQuery,
  RazorpayPaginationQuery,
  VerifyRazorpayPaymentInput,
  VerifyRazorpayPaymentResponse,
} from "./types";

const notesSchema = z
  .record(z.string().max(256), z.union([z.string().max(256), z.number()]))
  .refine((notes) => Object.keys(notes).length <= 15, {
    message: "Razorpay notes can contain at most 15 key-value pairs.",
  });

const createOrderBodySchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().length(3).toUpperCase().optional(),
  receipt: z.string().min(1).max(40).optional(),
  notes: notesSchema.optional(),
  partialPayment: z.boolean().optional(),
  firstPaymentMinAmount: z.number().int().positive().optional(),
}).superRefine((body, ctx) => {
  const currency = body.currency ?? "INR";

  if (currency === "INR" && body.amount < 100) {
    ctx.addIssue({
      code: "custom",
      message: RAZORPAY_ERROR_CODES.INVALID_ORDER_AMOUNT,
      path: ["amount"],
    });
  }

  if (body.firstPaymentMinAmount !== undefined && body.partialPayment !== true) {
    ctx.addIssue({
      code: "custom",
      message: RAZORPAY_ERROR_CODES.INVALID_PARTIAL_PAYMENT,
      path: ["firstPaymentMinAmount"],
    });
  }
});

const idQuerySchema = z.object({
  id: z.string().min(1),
});

const verifyPaymentBodySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

const capturePaymentBodySchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().length(3).toUpperCase().optional(),
});

const refundPaymentBodySchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().int().positive().optional(),
  speed: z.enum(["normal", "optimum"]).optional(),
  receipt: z.string().min(1).optional(),
  notes: notesSchema.optional(),
});

declare module "@better-auth/core" {
  interface BetterAuthPluginRegistry<AuthOptions, Options> {
    razorpay: {
      creator: typeof razorpay;
    };
  }
}

export const razorpay = <O extends RazorpayOptions>(options: O) => {
  if (!options.razorpayClient && (!options.keyId || !options.keySecret)) {
    throw new Error("Provide either razorpayClient or both keyId and keySecret.");
  }

  const client =
    options.razorpayClient ??
    new Razorpay({
      key_id: options.keyId!,
      key_secret: options.keySecret!,
    });
  const resolvedOptions = {
    ...options,
    razorpayClient: client,
  } as O & { razorpayClient: InstanceType<typeof Razorpay> };
  const defaultCurrency = options.defaultCurrency ?? "INR";
  const useSession = options.requireSession === false ? [] : [sessionMiddleware];

  const subscriptionEndpoints = options.subscription?.enabled
    ? {
        upgradeSubscription: upgradeSubscription(resolvedOptions),
        cancelSubscription: cancelSubscription(resolvedOptions),
        pauseSubscription: pauseSubscription(resolvedOptions),
        resumeSubscription: resumeSubscription(resolvedOptions),
        listSubscriptions: listSubscriptions(resolvedOptions),
        updateSubscription: updateSubscription(resolvedOptions),
        restoreSubscription: restoreSubscription(resolvedOptions),
        getSubscription: getSubscription(resolvedOptions),
      }
    : {};

  const razorpaySpecificEndpoints = {
    fetchSubscription: fetchSubscription(resolvedOptions),
    createSubscriptionLink: createSubscriptionLink(resolvedOptions),
    fetchPendingUpdate: fetchPendingUpdate(resolvedOptions),
    cancelPendingUpdate: cancelPendingUpdate(resolvedOptions),
    fetchInvoices: fetchInvoices(resolvedOptions),
    fetchAllInvoices: fetchAllInvoices(resolvedOptions),
    createInvoice: createInvoice(resolvedOptions),
    fetchInvoice: fetchInvoice(resolvedOptions),
    editInvoice: editInvoice(resolvedOptions),
    issueInvoice: issueInvoice(resolvedOptions),
    deleteInvoice: deleteInvoice(resolvedOptions),
    cancelInvoice: cancelInvoice(resolvedOptions),
    notifyByInvoice: notifyByInvoice(resolvedOptions),
    linkOffer: linkOffer(resolvedOptions),
    deleteOffer: deleteOffer(resolvedOptions),
    createSubscriptionAddon: createSubscriptionAddon(resolvedOptions),
    fetchAddon: fetchAddon(resolvedOptions),
    listAddons: listAddons(resolvedOptions),
    deleteAddon: deleteAddon(resolvedOptions),
    createPlan: createPlan(resolvedOptions),
    listPlans: listPlans(resolvedOptions),
    fetchPlan: fetchPlan(resolvedOptions),
    createCustomer: createCustomer(resolvedOptions),
    editCustomer: editCustomer(resolvedOptions),
    listCustomers: listCustomers(resolvedOptions),
    fetchCustomer: fetchCustomer(resolvedOptions),
    addBankAccount: addBankAccount(resolvedOptions),
    deleteBankAccount: deleteBankAccount(resolvedOptions),
    fetchTokens: fetchTokens(resolvedOptions),
    fetchToken: fetchToken(resolvedOptions),
    deleteToken: deleteToken(resolvedOptions),
    createItem: createItem(resolvedOptions),
    fetchItem: fetchItem(resolvedOptions),
    listItems: listItems(resolvedOptions),
    editItem: editItem(resolvedOptions),
    deleteItem: deleteItem(resolvedOptions),
    fetchRefund: fetchRefund(resolvedOptions),
    fetchAllRefunds: fetchAllRefunds(resolvedOptions),
    editRefund: editRefund(resolvedOptions),
    fetchAllPayments: fetchAllPayments(resolvedOptions),
    editPayment: editPayment(resolvedOptions),
    editOrder: editOrder(resolvedOptions),
    fetchPaymentsForOrder: fetchPaymentsForOrder(resolvedOptions),
    fetchAllOrders: fetchAllOrders(resolvedOptions),
    fetchAllSubscriptions: fetchAllSubscriptions(resolvedOptions),
  };

  const oneTimePaymentEndpoints = {
    createRazorpayOrder: createAuthEndpoint(
      "/razorpay/create-order",
      {
        method: "POST",
        body: createOrderBodySchema,
        use: useSession,
      },
      async (ctx) => {
        const body = {
          ...ctx.body,
          notes: sanitizeRazorpayNotes(ctx.body.notes),
        } satisfies CreateRazorpayOrderInput;
        const order = await client.orders.create(
          toRazorpayOrderInput(body, defaultCurrency),
        );

        return ctx.json(serializeRazorpayOrder(order as never));
      },
    ),
    getRazorpayOrder: createAuthEndpoint(
      "/razorpay/order",
      {
        method: "GET",
        query: idQuerySchema,
        use: useSession,
      },
      async (ctx) => {
        const order = await client.orders.fetch(ctx.query.id);

        return ctx.json(serializeRazorpayOrder(order as never));
      },
    ),
    getRazorpayPayment: createAuthEndpoint(
      "/razorpay/payment",
      {
        method: "GET",
        query: idQuerySchema,
        use: useSession,
      },
      async (ctx) => {
        const payment = await client.payments.fetch(ctx.query.id);

        return ctx.json(serializeRazorpayPayment(payment as never));
      },
    ),
    verifyRazorpayPayment: createAuthEndpoint(
      "/razorpay/verify-payment",
      {
        method: "POST",
        body: verifyPaymentBodySchema,
        use: useSession,
      },
      async (ctx) => {
        if (!options.keySecret) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Razorpay keySecret is required to verify payment signatures.",
          });
        }

        const valid = verifyRazorpayPaymentSignature(
          ctx.body.razorpayOrderId,
          ctx.body.razorpayPaymentId,
          ctx.body.razorpaySignature,
          options.keySecret,
        );

        if (!valid) {
          throw new APIError("BAD_REQUEST", {
            message: RAZORPAY_ERROR_CODES.INVALID_PAYMENT_SIGNATURE,
          });
        }

        return ctx.json({ valid });
      },
    ),
    captureRazorpayPayment: createAuthEndpoint(
      "/razorpay/payment/capture",
      {
        method: "POST",
        body: capturePaymentBodySchema,
        use: useSession,
      },
      async (ctx) => {
        const payment = await client.payments.capture(
          ctx.body.paymentId,
          ctx.body.amount,
          ctx.body.currency ?? defaultCurrency,
        );

        return ctx.json(serializeRazorpayPayment(payment as never));
      },
    ),
    refundRazorpayPayment: createAuthEndpoint(
      "/razorpay/payment/refund",
      {
        method: "POST",
        body: refundPaymentBodySchema,
        use: useSession,
      },
      async (ctx) => {
        const refundInput = {
          ...(ctx.body.amount !== undefined ? { amount: ctx.body.amount } : {}),
          ...(ctx.body.speed !== undefined ? { speed: ctx.body.speed } : {}),
          ...(ctx.body.receipt !== undefined ? { receipt: ctx.body.receipt } : {}),
          ...(ctx.body.notes !== undefined
            ? { notes: sanitizeRazorpayNotes(ctx.body.notes) }
            : {}),
        };
        const refund = await client.payments.refund(
          ctx.body.paymentId,
          refundInput as never,
        );

        return ctx.json(serializeRazorpayRefund(refund as never));
      },
    ),
  };

  return {
    id: "razorpay",
    version: PACKAGE_VERSION,
    endpoints: {
      ...oneTimePaymentEndpoints,
      razorpayWebhook: razorpayWebhook(resolvedOptions),
      ...razorpaySpecificEndpoints,
      ...((options.subscription?.enabled
        ? subscriptionEndpoints
        : {}) as O["subscription"] extends {
        enabled: true;
      }
        ? typeof subscriptionEndpoints
        : {}),
    },
    init(ctx) {
      if (options.organization?.enabled) {
        const orgPlugin = ctx.getPlugin("organization");
        if (!orgPlugin) {
          ctx.logger.error(`Organization plugin not found`);
          return;
        }

        const existingHooks = orgPlugin.options?.organizationHooks ?? {};

        /**
         * Sync organization name to Razorpay customer
         */
        const afterUpdateRazorpayOrg = async (data: {
          organization: (Organization & WithRazorpayCustomerId) | null;
          user: User;
        }) => {
          const { organization } = data;
          if (!organization?.razorpayCustomerId) return;

          try {
            const razorpayCustomer = await (client.customers as any).fetch(
              organization.razorpayCustomerId,
            );

            if (organization.name !== razorpayCustomer.name) {
              await (client.customers as any).edit(
                organization.razorpayCustomerId,
                { name: organization.name },
              );
              ctx.logger.info(
                `Synced organization name to Razorpay: "${razorpayCustomer.name}" → "${organization.name}"`,
              );
            }
          } catch (e: any) {
            ctx.logger.error(
              `Failed to sync organization to Razorpay: ${e.message}`,
            );
          }
        };

        /**
         * Block deletion if organization has active subscriptions
         */
        const beforeDeleteRazorpayOrg = async (data: {
          organization: Organization & WithRazorpayCustomerId;
          user: User;
        }) => {
          const { organization } = data;
          if (!organization.razorpayCustomerId) return;

          try {
            const subscriptions = await ctx.adapter.findMany<Subscription>({
              model: "subscription",
              where: [
                {
                  field: "razorpayCustomerId",
                  value: organization.razorpayCustomerId,
                },
              ],
            });

            for (const sub of subscriptions) {
              if (isActive(sub)) {
                throw createAPIError(
                  "BAD_REQUEST",
                  RAZORPAY_ERROR_CODES.ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION,
                );
              }
            }
          } catch (error: any) {
            if (error instanceof APIError) {
              throw error;
            }
            ctx.logger.error(
              `Failed to check organization subscriptions: ${error.message}`,
            );
            throw error;
          }
        };

        /**
         * Sync seat quantity when organization members change
         */
        const syncSeatsAfterMemberChange = async (data: {
          organization: Organization & WithRazorpayCustomerId;
        }) => {
          if (
            !options.subscription?.enabled ||
            !data.organization?.razorpayCustomerId
          ) {
            return;
          }

          try {
            const memberCount = await ctx.adapter.count({
              model: "member",
              where: [
                {
                  field: "organizationId",
                  value: data.organization.id,
                },
              ],
            });

            const plans = await getPlans(options.subscription);
            const quantityPlans = plans.filter((p) => p.quantity);
            if (quantityPlans.length === 0) return;

            const planNames = new Set(
              quantityPlans.map((p) => p.name.toLowerCase()),
            );
            const dbSub = await ctx.adapter.findOne<Subscription>({
              model: "subscription",
              where: [
                {
                  field: "referenceId",
                  value: data.organization.id,
                },
              ],
            });
            if (
              !dbSub?.razorpaySubscriptionId ||
              !isActive(dbSub) ||
              !planNames.has(dbSub.plan)
            ) {
              return;
            }

            // Update Razorpay subscription quantity
            await (client.subscriptions as any).update(
              dbSub.razorpaySubscriptionId,
              { quantity: memberCount },
            );
            await ctx.adapter.update({
              model: "subscription",
              update: { quantity: memberCount },
              where: [{ field: "id", value: dbSub.id }],
            });
          } catch (e: any) {
            ctx.logger.error(`Failed to sync seats to Razorpay: ${e.message}`);
          }
        };

        orgPlugin.options!.organizationHooks = {
          ...existingHooks,
          afterUpdateOrganization: existingHooks.afterUpdateOrganization
            ? async (data: any) => {
                await existingHooks.afterUpdateOrganization!(data);
                await afterUpdateRazorpayOrg(data);
              }
            : afterUpdateRazorpayOrg,
          beforeDeleteOrganization: existingHooks.beforeDeleteOrganization
            ? async (data: any) => {
                await existingHooks.beforeDeleteOrganization!(data);
                await beforeDeleteRazorpayOrg(data);
              }
            : beforeDeleteRazorpayOrg,
          afterAddMember: existingHooks.afterAddMember
            ? async (data: any) => {
                await existingHooks.afterAddMember!(data);
                await syncSeatsAfterMemberChange(data);
              }
            : syncSeatsAfterMemberChange,
          afterRemoveMember: existingHooks.afterRemoveMember
            ? async (data: any) => {
                await existingHooks.afterRemoveMember!(data);
                await syncSeatsAfterMemberChange(data);
              }
            : syncSeatsAfterMemberChange,
          afterAcceptInvitation: existingHooks.afterAcceptInvitation
            ? async (data: any) => {
                await existingHooks.afterAcceptInvitation!(data);
                await syncSeatsAfterMemberChange(data);
              }
            : syncSeatsAfterMemberChange,
        };
      }

      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                async after(user: User & WithRazorpayCustomerId, ctx) {
                  if (
                    !ctx ||
                    !options.createCustomerOnSignUp ||
                    user.razorpayCustomerId
                  ) {
                    return;
                  }

                  try {
                    // Check if a Razorpay customer with this email already exists
                    let existingCustomer: any;
                    try {
                      const result = await (client.customers as any).create({
                        name: user.name,
                        email: user.email,
                        fail_existing: "0", // Returns existing customer if found
                        notes: customerNotes.set({
                          userId: user.id,
                          customerType: "user",
                        }),
                      });
                      existingCustomer = result;
                    } catch (e: any) {
                      ctx.context.logger.error(
                        `Failed to create Razorpay customer: ${e.message}`,
                      );
                      return;
                    }

                    if (existingCustomer) {
                      await ctx.context.internalAdapter.updateUser(user.id, {
                        razorpayCustomerId: existingCustomer.id,
                      });

                      await options.onCustomerCreate?.(
                        {
                          razorpayCustomer: existingCustomer,
                          user: {
                            ...user,
                            razorpayCustomerId: existingCustomer.id,
                          },
                        },
                        ctx,
                      );

                      ctx.context.logger.info(
                        `Linked Razorpay customer ${existingCustomer.id} to user ${user.id}`,
                      );
                    }
                  } catch (e: any) {
                    ctx.context.logger.error(
                      `Failed to create or link Razorpay customer: ${e.message}`,
                      e,
                    );
                  }
                },
              },
              update: {
                async after(user: User & WithRazorpayCustomerId, ctx) {
                  if (!ctx || !user.razorpayCustomerId) return;

                  try {
                    const razorpayCustomer = await (
                      client.customers as any
                    ).fetch(user.razorpayCustomerId);

                    // Sync email if changed
                    if (razorpayCustomer.email !== user.email) {
                      await (client.customers as any).edit(
                        user.razorpayCustomerId,
                        { email: user.email },
                      );
                      ctx.context.logger.info(
                        `Updated Razorpay customer email from ${razorpayCustomer.email} to ${user.email}`,
                      );
                    }
                  } catch (e: any) {
                    ctx.context.logger.error(
                      `Failed to sync email to Razorpay customer: ${e.message}`,
                      e,
                    );
                  }
                },
              },
            },
          },
        },
      };
    },
    schema: getSchema(resolvedOptions),
    options: resolvedOptions as NoInfer<typeof resolvedOptions>,
  } satisfies BetterAuthPlugin;
};

export type RazorpayPlugin<O extends RazorpayOptions> = ReturnType<
  typeof razorpay<O>
>;

export const razorpayPlugin = razorpay;
