import { describe, expect, it } from "vitest";
import { RAZORPAY_ERROR_CODES } from "../src/error-codes";

describe("RAZORPAY_ERROR_CODES", () => {
  it("is defined", () => {
    expect(RAZORPAY_ERROR_CODES).toBeDefined();
  });

  it("contains all expected error code keys", () => {
    const expectedKeys = [
      "UNAUTHORIZED",
      "INVALID_REQUEST_BODY",
      "SUBSCRIPTION_NOT_FOUND",
      "SUBSCRIPTION_PLAN_NOT_FOUND",
      "ALREADY_SUBSCRIBED_PLAN",
      "REFERENCE_ID_NOT_ALLOWED",
      "CUSTOMER_NOT_FOUND",
      "UNABLE_TO_CREATE_CUSTOMER",
      "WEBHOOK_SIGNATURE_NOT_FOUND",
      "WEBHOOK_SECRET_NOT_FOUND",
      "WEBHOOK_ERROR",
      "FAILED_TO_VERIFY_WEBHOOK",
      "FAILED_TO_FETCH_PLANS",
      "EMAIL_VERIFICATION_REQUIRED",
      "SUBSCRIPTION_NOT_ACTIVE",
      "SUBSCRIPTION_ALREADY_CANCELLED",
      "SUBSCRIPTION_ALREADY_PAUSED",
      "SUBSCRIPTION_NOT_PAUSED",
      "ORGANIZATION_NOT_FOUND",
      "ORGANIZATION_SUBSCRIPTION_NOT_ENABLED",
      "AUTHORIZE_REFERENCE_REQUIRED",
      "ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION",
      "ORGANIZATION_REFERENCE_ID_REQUIRED",
      "PLAN_NOT_FOUND",
      "PLAN_CREATE_FAILED",
      "SUBSCRIPTION_CANCEL_FAILED",
      "SUBSCRIPTION_PAUSE_FAILED",
      "SUBSCRIPTION_RESUME_FAILED",
      "SUBSCRIPTION_UPDATE_FAILED",
      "SUBSCRIPTION_LINK_CREATE_FAILED",
      "INVOICE_FETCH_FAILED",
      "OFFER_LINK_FAILED",
      "OFFER_DELETE_FAILED",
      "CUSTOMER_EDIT_FAILED",
      "PENDING_UPDATE_NOT_FOUND",
      "PENDING_UPDATE_CANCEL_FAILED",
      "SUBSCRIPTION_RESTORE_FAILED",
      "SUBSCRIPTION_NOT_PENDING_CANCEL",
      "TRIAL_ALREADY_USED",
      "SUBSCRIPTION_RENEW_FAILED",
      "INVALID_PAYMENT_SIGNATURE",
      "INVALID_ORDER_AMOUNT",
      "INVALID_PARTIAL_PAYMENT",
      "SUBSCRIPTION_LIST_FAILED",
      // Refund errors
      "REFUND_NOT_FOUND",
      "REFUND_FETCH_FAILED",
      "REFUND_LIST_FAILED",
      "REFUND_EDIT_FAILED",
      // Invoice errors
      "INVOICE_NOT_FOUND",
      "INVOICE_CREATE_FAILED",
      "INVOICE_FETCH_FAILED",
      "INVOICE_LIST_FAILED",
      "INVOICE_EDIT_FAILED",
      "INVOICE_ISSUE_FAILED",
      "INVOICE_DELETE_FAILED",
      "INVOICE_CANCEL_FAILED",
      "INVOICE_NOTIFY_FAILED",
      // Order errors
      "ORDER_FETCH_FAILED",
      "ORDER_LIST_FAILED",
      "ORDER_EDIT_FAILED",
      "ORDER_PAYMENTS_FETCH_FAILED",
      // Payment errors
      "PAYMENT_LIST_FAILED",
      "PAYMENT_EDIT_FAILED",
      // Customer bank account errors
      "BANK_ACCOUNT_ADD_FAILED",
      "BANK_ACCOUNT_DELETE_FAILED",
      // Customer token errors
      "TOKEN_FETCH_FAILED",
      "TOKEN_DELETE_FAILED",
      // Add-on errors
      "ADDON_NOT_FOUND",
      "ADDON_FETCH_FAILED",
      "ADDON_LIST_FAILED",
      "ADDON_CREATE_FAILED",
      "ADDON_DELETE_FAILED",
      // Item errors
      "ITEM_NOT_FOUND",
      "ITEM_CREATE_FAILED",
      "ITEM_FETCH_FAILED",
      "ITEM_LIST_FAILED",
      "ITEM_EDIT_FAILED",
      "ITEM_DELETE_FAILED",
    ];

    for (const key of expectedKeys) {
      expect(RAZORPAY_ERROR_CODES).toHaveProperty(key);
    }
  });

  it("has 87 error codes", () => {
    expect(Object.keys(RAZORPAY_ERROR_CODES).length).toBe(87);
  });

  it("all error codes are non-empty strings", () => {
    for (const [key, value] of Object.entries(RAZORPAY_ERROR_CODES)) {
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it("error codes follow SCREAMING_SNAKE_CASE convention", () => {
    for (const key of Object.keys(RAZORPAY_ERROR_CODES)) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
