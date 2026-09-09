import type { PaymentMonth } from "./contracts";

export type YearMonth = { year: number; month: number };

export function isPaymentMonth(month: number): month is PaymentMonth {
  return [1, 4, 7, 10].includes(month);
}

export function getReferenceMonths(
  year: number,
  month: number,
): [YearMonth, YearMonth, YearMonth] {
  if (
    !Number.isInteger(year) ||
    year < 2006 ||
    year > 2100 ||
    !isPaymentMonth(month)
  )
    throw new Error("INVALID_PERIOD");
  return [-3, -2, -1].map((offset) => {
    const adjusted = month + offset;
    return {
      year: adjusted <= 0 ? year - 1 : year,
      month: adjusted <= 0 ? adjusted + 12 : adjusted,
    };
  }) as [YearMonth, YearMonth, YearMonth];
}

export function getIstanbulYearMonth(now = new Date()): YearMonth {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")!.value),
    month: Number(parts.find((part) => part.type === "month")!.value),
  };
}

export function isCompletePeriod(
  year: number,
  month: number,
  now = new Date(),
): boolean {
  getReferenceMonths(year, month);
  const current = getIstanbulYearMonth(now);
  return year * 12 + month <= current.year * 12 + current.month;
}

export function monthLabel(
  year: number,
  month: number,
  language: "tr" | "en",
  short = false,
): string {
  return new Intl.DateTimeFormat(language, {
    timeZone: "UTC",
    month: short ? "short" : "long",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

export function dateLabel(date: string, language: "tr" | "en"): string {
  return new Intl.DateTimeFormat(language, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
