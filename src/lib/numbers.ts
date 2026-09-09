import Decimal from "decimal.js";

export const NUMBER_LOCALES = ["tr-TR", "en-US", "de-DE", "fr-FR"] as const;
export type NumberLocale = (typeof NUMBER_LOCALES)[number];

function separators(locale: NumberLocale) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  return {
    group: parts.find((part) => part.type === "group")!.value,
    decimal: parts.find((part) => part.type === "decimal")!.value,
  };
}

export function parseLocalizedDecimal(
  input: string,
  locale: NumberLocale,
  places: number,
): string {
  if (input.length > 96) throw new Error("INVALID_NUMBER");
  const { group, decimal } = separators(locale);
  const value =
    locale === "fr-FR"
      ? input.trim().replace(/[ \u00a0\u202f]/g, group)
      : input.trim();
  const parts = value.split(decimal);
  if (parts.length > 2) throw new Error("INVALID_NUMBER");
  const [integer, fraction] = parts;
  const groups = integer.split(group);
  if (
    groups.length === 1
      ? !/^\d+$/.test(integer)
      : !/^\d{1,3}$/.test(groups[0]) ||
        groups.slice(1).some((part) => !/^\d{3}$/.test(part))
  ) {
    throw new Error("INVALID_NUMBER");
  }
  if (
    fraction !== undefined &&
    !new RegExp(`^\\d{1,${places}}$`).test(fraction)
  )
    throw new Error("INVALID_NUMBER");
  const canonical = `${groups.join("")}${fraction === undefined ? "" : `.${fraction}`}`;
  return new Decimal(canonical).toFixed();
}

/** Format exact decimal strings; conversion through a binary Number loses large cents. */
export function formatDecimal(
  value: string,
  locale: NumberLocale,
  places = 2,
): string {
  const [integer, fraction] = new Decimal(value)
    .toFixed(places, Decimal.ROUND_HALF_UP)
    .split(".");
  const grouped = new Intl.NumberFormat(locale).format(BigInt(integer));
  return fraction === undefined
    ? grouped
    : `${grouped}${separators(locale).decimal}${fraction}`;
}

export function reformatInput(
  value: string,
  from: NumberLocale,
  to: NumberLocale,
  places: number,
): string {
  if (!value.trim()) return value;
  try {
    const decimal = parseLocalizedDecimal(value, from, places);
    return formatDecimal(decimal, to, new Decimal(decimal).decimalPlaces());
  } catch {
    // Invalid text cannot safely be reinterpreted under a different number format.
    return "";
  }
}
