import { describe, expect, it } from "vitest";
import { parseLocalizedDecimal, formatDecimal } from "./numbers";

describe("explicit locale decimal input", () => {
  it.each([
    ["1.234,56", "tr-TR", "1234.56"],
    ["1,234.56", "en-US", "1234.56"],
    ["1.234,56", "de-DE", "1234.56"],
    ["1\u202f234,56", "fr-FR", "1234.56"],
    ["1\u00a0234,56", "fr-FR", "1234.56"],
    ["1 234,56", "fr-FR", "1234.56"],
    [" 00123,40 ", "tr-TR", "123.4"],
    ["45.1234", "en-US", "45.1234"],
  ] as const)("parses %s with %s", (input, locale, expected) => {
    expect(parseLocalizedDecimal(input, locale, 4)).toBe(expected);
  });
  it.each([
    "1,234.56",
    "1.23,45",
    "12.34",
    "1,2,3",
    "1e3",
    "-100",
    "Infinity",
    "",
    "1,",
    ",5",
    "1 234",
    "<script>",
    "9".repeat(100),
  ])("rejects ambiguous or malformed TR input %s", (input) => {
    expect(() => parseLocalizedDecimal(input, "tr-TR", 2)).toThrow();
  });
  it("rejects too many decimals instead of silently rounding user input", () => {
    expect(() => parseLocalizedDecimal("1,234", "tr-TR", 2)).toThrow();
    expect(parseLocalizedDecimal("1,234", "en-US", 2)).toBe("1234");
  });
  it("formats display values without changing the underlying decimal", () => {
    expect(formatDecimal("51000.00", "tr-TR", 2)).toBe("51.000,00");
    expect(formatDecimal("51000.00", "en-US", 2)).toBe("51,000.00");
    expect(formatDecimal("43.123456789", "tr-TR", 4)).toBe("43,1235");
  });
});
