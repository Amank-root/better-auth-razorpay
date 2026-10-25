export const RAZORPAY_ERROR_CODES = {
  UNAUTHORIZED: "Unauthorized access",
  INVALID_REQUEST_BODY: "Invalid request body",
  SUBSCRIPTION_NOT_FOUND: "Subscription not found",
  SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
  ALREADY_SUBSCRIBED_PLAN: "You're already subscribed to this plan",
  REFERENCE_ID_NOT_ALLOWED: "Reference id is not allowed",
  CUSTOMER_NOT_FOUND: "Razorpay customer not found for this user",
  UNABLE_TO_CREATE_CUSTOMER: "Unable to create Razorpay customer",
  WEBHOOK_SIGNATURE_NOT_FOUND: "Razorpay webhook signature not found",
  WEBHOOK_SECRET_NOT_FOUND: "Razorpay webhook secret not found",
  WEBHOOK_ERROR: "Razorpay webhook error",
  FAILED_TO_VERIFY_WEBHOOK: "Failed to verify Razorpay webhook signature",
  FAILED_TO_FETCH_PLANS: "Failed to fetch plans",
  EMAIL_VERIFICATION_REQUIRED:
    "Email verification is required before you can subscribe to a plan",
  SUBSCRIPTION_NOT_ACTIVE: "Subscription is not active",
  SUBSCRIPTION_ALREADY_CANCELLED: "Subscription is already cancelled",
  SUBSCRIPTION_ALREADY_PAUSED: "Subscription is already paused",
  SUBSCRIPTION_NOT_PAUSED: "Subscription is not paused, cannot resume",
  ORGANIZATION_NOT_FOUND: "Organization not found",
  ORGANIZATION_SUBSCRIPTION_NOT_ENABLED:
    "Organization subscription is not enabled",
  AUTHORIZE_REFERENCE_REQUIRED:
    "Organization subscriptions require authorizeReference callback to be configured",
  ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION:
    "Cannot delete organization with active subscription",
  ORGANIZATION_REFERENCE_ID_REQUIRED:
    "Reference ID is required. Provide referenceId or set activeOrganizationId in session",
  PLAN_NOT_FOUND: "Razorpay plan not found",
  PLAN_CREATE_FAILED: "Failed to create Razorpay plan",
  SUBSCRIPTION_CANCEL_FAILED: "Failed to cancel subscription",
  SUBSCRIPTION_PAUSE_FAILED: "Failed to pause subscription",
  SUBSCRIPTION_RESUME_FAILED: "Failed to resume subscription",
  SUBSCRIPTION_UPDATE_FAILED: "Failed to update subscription",
  SUBSCRIPTION_LINK_CREATE_FAILED: "Failed to create subscription link",
  SUBSCRIPTION_INVOICE_FETCH_FAILED: "Failed to fetch invoices",
  OFFER_LINK_FAILED: "Failed to link offer to subscription",
  OFFER_DELETE_FAILED: "Failed to delete offer from subscription",
  CUSTOMER_EDIT_FAILED: "Failed to edit customer details",
  PENDING_UPDATE_NOT_FOUND: "No pending update found for subscription",
  PENDING_UPDATE_CANCEL_FAILED: "Failed to cancel pending update",
  SUBSCRIPTION_RESTORE_FAILED: "Failed to restore subscription",
  SUBSCRIPTION_NOT_PENDING_CANCEL:
    "Subscription is not pending cancellation, cannot restore",
  TRIAL_ALREADY_USED:
    "You have already used a free trial and are not eligible for another",
  SUBSCRIPTION_RENEW_FAILED: "Failed to process subscription renewal",
  INVALID_PAYMENT_SIGNATURE: "Invalid Razorpay payment signature.",
  INVALID_ORDER_AMOUNT: "Razorpay order amount must be at least 100 subunits for INR.",
  INVALID_PARTIAL_PAYMENT: "firstPaymentMinAmount can only be used when partialPayment is true.",

  // Refund errors
  REFUND_NOT_FOUND: "Refund not found",
  REFUND_FETCH_FAILED: "Failed to fetch refund",
  REFUND_LIST_FAILED: "Failed to list refunds",
  REFUND_EDIT_FAILED: "Failed to edit refund",

  // Subscription list errors
  SUBSCRIPTION_LIST_FAILED: "Failed to list subscriptions from Razorpay",

  // Invoice errors
  INVOICE_NOT_FOUND: "Invoice not found",
  INVOICE_CREATE_FAILED: "Failed to create invoice",
  INVOICE_FETCH_FAILED: "Failed to fetch invoice",
  INVOICE_LIST_FAILED: "Failed to list invoices",
  INVOICE_EDIT_FAILED: "Failed to edit invoice",
  INVOICE_ISSUE_FAILED: "Failed to issue invoice",
  INVOICE_DELETE_FAILED: "Failed to delete invoice",
  INVOICE_CANCEL_FAILED: "Failed to cancel invoice",
  INVOICE_NOTIFY_FAILED: "Failed to send invoice notification",

  // Order errors
  ORDER_FETCH_FAILED: "Failed to fetch order",
  ORDER_LIST_FAILED: "Failed to list orders",
  ORDER_EDIT_FAILED: "Failed to edit order",
  ORDER_PAYMENTS_FETCH_FAILED: "Failed to fetch payments for order",

  // Payment errors
  PAYMENT_LIST_FAILED: "Failed to list payments",
  PAYMENT_EDIT_FAILED: "Failed to edit payment",
  PAYMENT_FETCH_FAILED: "Failed to fetch payment from Razorpay",
  PAYMENT_NOT_CAPTURED:
    "Payment is not captured. Only provision goods after receiving the order.paid webhook event.",
  PAYMENT_AMOUNT_MISMATCH:
    "Payment amount does not match the expected amount.",
  PAYMENT_ORDER_MISMATCH: "Payment does not belong to the specified order.",

  // Customer bank account errors
  BANK_ACCOUNT_ADD_FAILED: "Failed to add bank account to customer",
  BANK_ACCOUNT_DELETE_FAILED: "Failed to delete bank account from customer",

  // Customer token errors
  TOKEN_FETCH_FAILED: "Failed to fetch customer tokens",
  TOKEN_DELETE_FAILED: "Failed to delete customer token",

  // Add-on errors
  ADDON_NOT_FOUND: "Add-on not found",
  ADDON_FETCH_FAILED: "Failed to fetch add-on",
  ADDON_LIST_FAILED: "Failed to list add-ons",
  ADDON_CREATE_FAILED: "Failed to create add-on",
  ADDON_DELETE_FAILED: "Failed to delete add-on",

  // Item errors
  ITEM_NOT_FOUND: "Item not found",
  ITEM_CREATE_FAILED: "Failed to create item",
  ITEM_FETCH_FAILED: "Failed to fetch item",
  ITEM_LIST_FAILED: "Failed to list items",
  ITEM_EDIT_FAILED: "Failed to edit item",
  ITEM_DELETE_FAILED: "Failed to delete item",

  // Transfer errors
  TRANSFER_CREATE_FAILED: "Failed to create transfer",
  TRANSFER_FETCH_FAILED: "Failed to fetch transfer",
  TRANSFER_LIST_FAILED: "Failed to list transfers",
  TRANSFER_EDIT_FAILED: "Failed to edit transfer",
  TRANSFER_REVERSE_FAILED: "Failed to reverse transfer",
} as const;
