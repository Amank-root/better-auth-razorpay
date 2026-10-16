import { describe, expect, it } from "vitest";

import { sanitizeRazorpayNotes } from "../src/notes.js";

describe("Razorpay notes sanitizer", () => {
  it("drops unsafe object keys from user-supplied notes", () => {
    const notes = sanitizeRazorpayNotes({
      __proto__: "polluted",
      constructor: "unsafe",
      prototype: "unsafe",
      plan: "pro",
    });

    expect(notes).toEqual({ plan: "pro" });
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
});
