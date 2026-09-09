import { describe, expect, it } from "vitest";
import {
  getReferenceMonths,
  isPaymentMonth,
  isCompletePeriod,
  getIstanbulYearMonth,
} from "./periods";

describe("calendar periods", () => {
  it("carries January into the previous year", () => {
    expect(getReferenceMonths(2026, 1)).toEqual([
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
    ]);
  });
  it("uses only the previous three months for October", () => {
    expect(getReferenceMonths(2026, 10)).toEqual([
      { year: 2026, month: 7 },
      { year: 2026, month: 8 },
      { year: 2026, month: 9 },
    ]);
  });
  it("identifies exactly four payment months", () => {
    expect(
      Array.from({ length: 12 }, (_, i) => i + 1).filter(isPaymentMonth),
    ).toEqual([1, 4, 7, 10]);
  });
  it("uses Istanbul calendar boundaries regardless of host timezone", () => {
    const now = new Date("2026-09-30T21:00:00Z");
    expect(getIstanbulYearMonth(now)).toEqual({ year: 2026, month: 10 });
    expect(isCompletePeriod(2026, 10, now)).toBe(true);
    expect(isCompletePeriod(2026, 10, new Date("2026-09-30T20:59:59Z"))).toBe(
      false,
    );
  });
  it("rejects malformed and unsupported periods", () => {
    expect(() => getReferenceMonths(2026, 2)).toThrow();
    expect(() => getReferenceMonths(1996, 1)).toThrow();
    expect(() => getReferenceMonths(2026.5, 4)).toThrow();
  });
});
