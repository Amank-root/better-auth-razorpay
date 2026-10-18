import type { BetterAuthClientPlugin } from "better-auth/client";
import type { razorpay } from "./index";
import type { RazorpayPlan } from "./types";
export const razorpayClient = <
  O extends {
    subscription: boolean;
  } = {
    subscription: false;
  },
>(
  options?: O | undefined,
) => {
  return {
    id: "razorpay-client",
    $InferServerPlugin: {} as ReturnType<
      typeof razorpay<
        O["subscription"] extends true
          ? {
              razorpayClient: any;
              razorpayWebhookSecret: string;
              subscription: {
                enabled: true;
                plans: RazorpayPlan[];
              };
            }
          : {
              razorpayClient: any;
              razorpayWebhookSecret: string;
            }
      >
    >,
    pathMethods: {
      "/razorpay/create-order": "POST",
      "/razorpay/verify-payment": "POST",
      "/razorpay/order": "GET",
      "/razorpay/order/edit": "POST",
      "/razorpay/order/payments": "GET",
      "/razorpay/order/list": "GET",
      "/razorpay/subscription/list": "GET",
      "/razorpay/payment": "GET",
      "/razorpay/payment/capture": "POST",
      "/razorpay/payment/refund": "POST",
      "/razorpay/payment/list": "GET",
      "/razorpay/payment/edit": "POST",
      "/razorpay/refund/get": "GET",
      "/razorpay/refund/list": "GET",
      "/razorpay/refund/edit": "POST",
      "/razorpay/invoice/create": "POST",
      "/razorpay/invoice/get": "GET",
      "/razorpay/invoice/edit": "POST",
      "/razorpay/invoice/list": "GET",
      "/razorpay/invoice/issue": "POST",
      "/razorpay/invoice/delete": "POST",
      "/razorpay/invoice/cancel": "POST",
      "/razorpay/invoice/notify": "POST",
      "/subscription/pause": "POST",
      "/subscription/upgrade": "POST",
      "/subscription/cancel": "POST",
      "/subscription/list": "GET",
      "/subscription/resume": "POST",
      "/subscription/update": "POST",
      "/subscription/restore": "POST",
      "/subscription/get": "GET",
      "/razorpay/subscription/get": "GET",
      "/razorpay/subscription-link": "POST",
      "/razorpay/subscription/addon": "POST",
      "/razorpay/subscription/pending-update": "GET",
      "/razorpay/subscription/cancel-update": "POST",
      "/razorpay/subscription/invoices": "GET",
      "/razorpay/subscription/link-offer": "POST",
      "/razorpay/subscription/delete-offer": "POST",
      "/razorpay/plan/create": "POST",
      "/razorpay/plan/list": "GET",
      "/razorpay/plan/get": "GET",
      "/razorpay/customer/create": "POST",
      "/razorpay/customer/edit": "POST",
      "/razorpay/customer/list": "GET",
      "/razorpay/customer/get": "GET",
      "/razorpay/customer/bank-account": "POST",
      "/razorpay/customer/bank-account/delete": "POST",
      "/razorpay/customer/tokens": "GET",
      "/razorpay/customer/token": "GET",
      "/razorpay/customer/token/delete": "POST",
      "/razorpay/addon/get": "GET",
      "/razorpay/addon/list": "GET",
      "/razorpay/addon/delete": "POST",
      "/razorpay/item/create": "POST",
      "/razorpay/item/get": "GET",
      "/razorpay/item/list": "GET",
      "/razorpay/item/edit": "POST",
      "/razorpay/item/delete": "POST",
    },
  } satisfies BetterAuthClientPlugin;
};
export * from "./error-codes";
export const razorpayClientPlugin = razorpayClient;
