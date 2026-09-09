import { describe, expect, it } from "vitest";
import { calculateSalary } from "./calculator";

describe("protected salary policy", () => {
  it("pays 51000 using the new average for base salary and a three-month adjustment", () => {
    const result = calculateSalary("1000", "43", ["44", "45", "46"]);
    expect(result).toMatchObject({
      averageRate: "45",
      effectiveRate: "45",
      rateDifference: "2",
      baseSalary: "45000.00",
      adjustment: "6000.00",
      total: "51000.00",
      protected: false,
    });
  });
  it("protects both base salary and adjustment against falling rates", () => {
    expect(calculateSalary("1000", "43", ["40", "41", "42"])).toMatchObject({
      averageRate: "41",
      effectiveRate: "43",
      rateDifference: "0",
      baseSalary: "43000.00",
      adjustment: "0.00",
      total: "43000.00",
      protected: true,
    });
  });
  it("has no adjustment when rates match", () => {
    expect(calculateSalary("1000", "43", ["42", "43", "44"])).toMatchObject({
      total: "43000.00",
      adjustment: "0.00",
      protected: false,
    });
  });
  it("uses the existing protected rate in ordinary months", () => {
    expect(calculateSalary("1000", "45")).toMatchObject({
      averageRate: null,
      effectiveRate: "45",
      baseSalary: "45000.00",
      total: "45000.00",
      adjustment: "0.00",
    });
  });
  it("does not round the average before computing the adjustment", () => {
    expect(
      calculateSalary("1000", "43", ["43", "43", "43.0001"]),
    ).toMatchObject({
      baseSalary: "43000.03",
      adjustment: "0.10",
      total: "43000.13",
    });
  });
  it("rounds payable components half-up and totals their displayed amounts", () => {
    expect(
      calculateSalary("1", "1", ["1.005", "1.005", "1.005"]),
    ).toMatchObject({ baseSalary: "1.01", adjustment: "0.02", total: "1.03" });
  });
  it.each([
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1e5",
    "1,000",
    "1.001",
    "1000000001",
  ])("rejects invalid salary %s", (salary) => {
    expect(() => calculateSalary(salary, "43")).toThrow();
  });
  it("preserves the computed rate when carried into an ordinary month", () => {
    const quarter = calculateSalary("1000", "43", ["43", "43", "43.0001"]);
    expect(calculateSalary("1000", quarter.effectiveRate).total).toBe(
      "43000.03",
    );
  });
  it("does not round long protected rates across a half-cent boundary", () => {
    expect(
      calculateSalary(
        "1",
        "1.00499999999999999999999999999999999999999999999999",
      ).total,
    ).toBe("1.00");
  });
  it("limits published and manual source rates to four decimal places", () => {
    expect(() =>
      calculateSalary("1000", "43", ["43.00001", "44", "45"]),
    ).toThrow();
  });
  it.each(["0", "-1", "NaN", "1e2", "1000001"])(
    "rejects invalid rate %s",
    (rate) => {
      expect(() => calculateSalary("1000", rate)).toThrow();
      expect(() => calculateSalary("1000", "43", [rate, "44", "45"])).toThrow();
    },
  );
});
