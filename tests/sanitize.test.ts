import { describe, expect, it } from "vitest";
import { containsForbidden, sanitizeUserFacing } from "@/lib/discovery/sanitize";

describe("sanitizeUserFacing", () => {
  it("detects emojis and every dash variant", () => {
    expect(containsForbidden("all good")).toBe(false);
    expect(containsForbidden("hello \u{1F600}")).toBe(true);
    expect(containsForbidden("follow-up")).toBe(true);
    expect(containsForbidden("prices — times")).toBe(true);
    expect(containsForbidden("a – b")).toBe(true);
  });

  it("removes emojis", () => {
    const out = sanitizeUserFacing("Great \u{1F44D} to hear");
    expect(containsForbidden(out)).toBe(false);
    expect(out).not.toMatch(/\u{1F44D}/u);
  });

  it("turns an em dash into readable punctuation", () => {
    const out = sanitizeUserFacing("It is repetitive — but the calendar matters");
    expect(out).toBe("It is repetitive, but the calendar matters");
    expect(containsForbidden(out)).toBe(false);
  });

  it("joins hyphenated words with a space", () => {
    const out = sanitizeUserFacing("a non-technical follow-up plan");
    expect(out).toBe("a non technical follow up plan");
    expect(containsForbidden(out)).toBe(false);
  });

  it("handles a spaced hyphen used as a dash", () => {
    const out = sanitizeUserFacing("prices - available times");
    expect(out).toBe("prices, available times");
    expect(containsForbidden(out)).toBe(false);
  });

  it("separates hyphenated numbers", () => {
    const out = sanitizeUserFacing("open 9-5 today");
    expect(containsForbidden(out)).toBe(false);
    expect(out).toBe("open 9 5 today");
  });
});
