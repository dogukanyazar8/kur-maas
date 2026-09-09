import Decimal from "decimal.js";

// Headroom for 50 fractional input digits and the largest allowed salary product.
const Money = Decimal.clone({
  precision: 100,
  rounding: Decimal.ROUND_HALF_UP,
});

export type SalaryResult = {
  averageRate: string | null;
  effectiveRate: string;
  rateDifference: string;
  baseSalary: string;
  adjustment: string;
  total: string;
  protected: boolean;
};

function positiveDecimal(
  value: string,
  places: number,
  maximum: number,
): Decimal {
  if (
    value.length > 96 ||
    !new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(value)
  ) {
    throw new Error("INVALID_NUMBER");
  }
  const number = new Money(value);
  if (!number.gt(0) || number.gt(maximum)) throw new Error("INVALID_NUMBER");
  return number;
}

export function calculateSalary(
  salary: string,
  currentRate: string,
  rates?: readonly [string, string, string],
): SalaryResult {
  const usd = positiveDecimal(salary, 2, 1_000_000_000);
  const existing = positiveDecimal(currentRate, 50, 1_000_000);
  const sum = rates?.reduce(
    (total, value) => total.plus(positiveDecimal(value, 4, 1_000_000)),
    new Money(0),
  );
  const average = sum?.div(3);
  const effective = average ? Money.max(average, existing) : existing;
  // Avoid multiplying a recurring rounded average by 3 in the adjustment.
  const extra = sum
    ? Money.max(sum.minus(existing.times(3)), 0).times(usd)
    : new Money(0);
  const baseSalary = effective.times(usd).toDecimalPlaces(2);
  const adjustment = extra.toDecimalPlaces(2);

  return {
    averageRate: average?.toDecimalPlaces(50).toFixed() ?? null,
    effectiveRate: effective.toDecimalPlaces(50).toFixed(),
    rateDifference: Money.max(effective.minus(existing), 0)
      .toDecimalPlaces(50)
      .toFixed(),
    baseSalary: baseSalary.toFixed(2),
    adjustment: adjustment.toFixed(2),
    total: baseSalary.plus(adjustment).toFixed(2),
    protected: average ? average.lt(existing) : false,
  };
}
