import type { RazorpayNotes } from "./types.js";

const UNSAFE_NOTE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const sanitizeRazorpayNotes = (
  notes: RazorpayNotes | undefined,
): RazorpayNotes | undefined => {
  if (!notes) {
    return undefined;
  }

  const safeNotes: RazorpayNotes = {};

  for (const [key, value] of Object.entries(notes)) {
    if (UNSAFE_NOTE_KEYS.has(key)) {
      continue;
    }

    safeNotes[key] = value;
  }

  return safeNotes;
};
