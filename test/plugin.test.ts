import { describe, expect, it } from "vitest";
import { razorpayPlugin } from "../src/index";

// Regression tests for the "subscription option blocks one-time-only plugin
// setup" bug. The plugin must be usable for stores that only sell products via
// one-time Razorpay orders, without opting into subscriptions.
//
// Acceptance criteria:
//  - Omitted and `enabled: false` subscription options initialize successfully.
//  - One-time order creation and payment-verification endpoints remain
//    available in those modes.
//  - Subscription-only endpoint factories are only constructed when
//    subscriptions are enabled.
//  - Subscription schema is absent when subscriptions are disabled.

const baseOptions = {
  keyId: "test_id",
  keySecret: "test_secret",
  razorpayWebhookSecret: "secret",
};

function build(options: Parameters<typeof razorpayPlugin>[0]) {
  // Constructing the plugin must never throw for any valid subscription
  // configuration; a throw surfaces as a failed assertion below.
  return razorpayPlugin(options);
}

// The plugin's endpoint type is conditional on `subscription.enabled`, so
// subscription-only endpoints are not statically present when subscriptions are
// omitted/disabled. These are runtime presence checks, so read through a record.
function endpoints(plugin: ReturnType<typeof build>): Record<string, unknown> {
  return plugin.endpoints as Record<string, unknown>;
}

describe("razorpayPlugin: subscription-optional construction", () => {
  it("constructs when subscription is omitted", () => {
    const plugin = build({ ...baseOptions });
    const ep = endpoints(plugin);

    // One-time endpoints remain available.
    expect(ep.createRazorpayOrder).toBeDefined();
    expect(ep.getRazorpayOrder).toBeDefined();
    expect(ep.verifyRazorpayPayment).toBeDefined();
    expect(ep.captureRazorpayPayment).toBeDefined();
    expect(ep.refundRazorpayPayment).toBeDefined();

    // Subscription-only endpoints are not constructed.
    expect(ep.upgradeSubscription).toBeUndefined();
    expect(ep.cancelSubscription).toBeUndefined();
    expect(ep.fetchAllSubscriptions).toBeUndefined();

    // No subscription table in the schema.
    expect(plugin.schema).not.toHaveProperty("subscription");
  });

  it("constructs when subscription is explicitly disabled", () => {
    const plugin = build({ ...baseOptions, subscription: { enabled: false } });
    const ep = endpoints(plugin);

    expect(ep.createRazorpayOrder).toBeDefined();
    expect(ep.verifyRazorpayPayment).toBeDefined();

    expect(ep.upgradeSubscription).toBeUndefined();
    expect(ep.fetchAllSubscriptions).toBeUndefined();

    expect(plugin.schema).not.toHaveProperty("subscription");
  });

  it("constructs when subscription is enabled with no plans", () => {
    const plugin = build({
      ...baseOptions,
      subscription: { enabled: true, plans: [] },
    });
    const ep = endpoints(plugin);

    // One-time endpoints remain available.
    expect(ep.createRazorpayOrder).toBeDefined();
    expect(ep.verifyRazorpayPayment).toBeDefined();

    // Subscription endpoints (including the Razorpay API list) are constructed.
    expect(ep.upgradeSubscription).toBeDefined();
    expect(ep.fetchAllSubscriptions).toBeDefined();

    expect(plugin.schema).toHaveProperty("subscription");
  });

  it("constructs when subscription is enabled with plans", () => {
    const plugin = build({
      ...baseOptions,
      subscription: {
        enabled: true,
        plans: [{ planId: "plan_1", name: "pro" }],
      },
    });
    const ep = endpoints(plugin);

    expect(ep.createRazorpayOrder).toBeDefined();
    expect(ep.upgradeSubscription).toBeDefined();
    expect(ep.fetchAllSubscriptions).toBeDefined();
    expect(plugin.schema).toHaveProperty("subscription");
  });

  it("does not throw for any subscription configuration", () => {
    // Runtime fixtures: `any` avoids discriminated-union widening noise from the
    // mixed enabled/plan literals below.
    const configs: any[] = [
      {},
      { subscription: { enabled: false } },
      { subscription: { enabled: true, plans: [] } },
      {
        subscription: {
          enabled: true,
          plans: [{ planId: "plan_1", name: "pro" }],
        },
      },
    ];

    for (const config of configs) {
      expect(() => build({ ...baseOptions, ...config })).not.toThrow();
    }
  });
});
