import { describe, expect, it } from "vitest";
import { calculateBusinessDays, isValidDateRange } from "./leave-days";

describe("leave-day calculation", () => {
  it("excludes weekends and configured holidays", () => {
    expect(calculateBusinessDays({ startDate: "2026-10-19", endDate: "2026-10-23", holidays: ["2026-10-23"] })).toBe(4);
  });
  it("supports half days", () => {
    expect(calculateBusinessDays({ startDate: "2026-10-19", endDate: "2026-10-20", startHalfDay: true, endHalfDay: true })).toBe(1);
    expect(calculateBusinessDays({ startDate: "2026-10-19", endDate: "2026-10-19", startHalfDay: true })).toBe(0.5);
  });
  it("rejects invalid ranges", () => {
    expect(isValidDateRange("2026-10-21", "2026-10-20")).toBe(false);
    expect(calculateBusinessDays({ startDate: "2026-10-21", endDate: "2026-10-20" })).toBe(0);
  });
});
