import { XMLParser, XMLValidator } from "fast-xml-parser";
import type {
  ApiErrorCode,
  PaymentMonth,
  RatePoint,
  RatesResponse,
  ScenarioRate,
  ScenarioRatesResponse,
} from "./contracts";
import { getReferenceMonths, isPaymentMonth } from "./periods";

const MAX_BODY_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const MONTH_TIMEOUT_MS = 24_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const CURRENT_MONTH_CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 96;
const MAX_ACTIVE_MONTHS = 6;
const MAX_PUBLICATION_ATTEMPTS = 10;

export class TcmbError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status?: number,
    cause?: unknown,
  ) {
    super("TCMB exchange-rate request failed.", { cause });
    this.name = "TcmbError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePublication(xml: string, date: string): string {
  // TCMB needs neither DTDs nor entity expansion. Reject declarations before parsing.
  if (
    /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  ) {
    throw new TcmbError("UPSTREAM_ERROR");
  }
  const parsed: unknown = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
    trimValues: true,
  }).parse(xml);
  const root = record(parsed) ? parsed.Tarih_Date : undefined;
  const [year, month, day] = date.split("-");
  if (
    !record(root) ||
    root["@_Tarih"] !== `${day}.${month}.${year}` ||
    root["@_Date"] !== `${month}/${day}/${year}`
  ) {
    throw new TcmbError("UPSTREAM_ERROR");
  }
  const currencies: unknown[] = Array.isArray(root.Currency)
    ? root.Currency
    : [root.Currency];
  const dollars = currencies.filter(
    (currency) =>
      record(currency) &&
      (currency["@_Kod"] === "USD" || currency["@_CurrencyCode"] === "USD"),
  );
  const dollar = dollars[0];
  if (
    dollars.length !== 1 ||
    !record(dollar) ||
    dollar["@_Kod"] !== "USD" ||
    dollar["@_CurrencyCode"] !== "USD" ||
    dollar.Unit !== "1"
  ) {
    throw new TcmbError("UPSTREAM_ERROR");
  }
  const value = dollar.ForexBuying;
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value) ||
    !Number.isFinite(Number(value)) ||
    Number(value) <= 0
  ) {
    throw new TcmbError("UPSTREAM_ERROR");
  }
  return value;
}

function decodeXml(bytes: Uint8Array): string {
  const hasUtf8Bom =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const offset = hasUtf8Bom ? 3 : 0;
  // XML declarations use ASCII in both supported encodings; inspect only a bounded prefix.
  const prefix = String.fromCharCode(...bytes.subarray(offset, offset + 512));
  const declaration = /^<\?xml\s[\s\S]*?\?>/.exec(prefix)?.[0];
  if (/^<\?xml(?:\s|$)/.test(prefix) && !declaration)
    throw new TcmbError("UPSTREAM_ERROR");
  const encoding =
    declaration?.match(/\bencoding\s*=\s*(["'])(.*?)\1/)?.[2].toLowerCase() ??
    "utf-8";
  if (
    (encoding !== "utf-8" && encoding !== "iso-8859-9") ||
    (hasUtf8Bom && encoding !== "utf-8")
  ) {
    throw new TcmbError("UPSTREAM_ERROR");
  }
  // TextDecoder maps ISO-8859-9 to Windows-1254, including historical Turkish currency names.
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}

async function readXml(
  response: Response,
  aborted: Promise<never>,
): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)
  ) {
    await response.body?.cancel();
    throw new TcmbError("UPSTREAM_ERROR");
  }
  if (!response.body) throw new TcmbError("UPSTREAM_ERROR");
  const reader = response.body.getReader();
  // A single fixed buffer also bounds memory when the upstream sends many tiny chunks.
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let length = 0;
  let finished = false;
  try {
    while (true) {
      const result = await Promise.race([reader.read(), aborted]);
      if (result.done) {
        finished = true;
        break;
      }
      if (length + result.value.byteLength > MAX_BODY_BYTES)
        throw new TcmbError("UPSTREAM_ERROR");
      bytes.set(result.value, length);
      length += result.value.byteLength;
    }
    return decodeXml(bytes.subarray(0, length));
  } finally {
    try {
      if (!finished) await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}

type ClientOptions = { fetch?: typeof fetch; now?: () => number };

export function createTcmbClient(options: ClientOptions = {}) {
  const fetchRate = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { rate: RatePoint; expiresAt: number }>();
  const pending = new Map<string, Promise<RatePoint>>();
  let activeMonths = 0;

  function cached(key: string, timestamp = now()): RatePoint | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= timestamp) {
      cache.delete(key);
      return undefined;
    }
    return entry.rate;
  }

  async function publication(
    date: string,
    signal: AbortSignal,
  ): Promise<RatePoint | null> {
    const [year, month, day] = date.split("-");
    const source = `https://www.tcmb.gov.tr/kurlar/${year}${month}/${day}${month}${year}.xml`;
    const request = new AbortController();
    const timer = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
    const combined = AbortSignal.any([signal, request.signal]);
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(new TcmbError("UPSTREAM_ERROR"));
      if (combined.aborted) onAbort();
      else combined.addEventListener("abort", onAbort, { once: true });
    });
    try {
      const response = await Promise.race([
        fetchRate(source, {
          redirect: "error",
          signal: combined,
          headers: { Accept: "application/xml" },
        }),
        aborted,
      ]);
      // Only absent publications permit date fallback; outages must not silently alter the rate.
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 404) return null;
        throw new TcmbError("UPSTREAM_ERROR", response.status);
      }
      const value = parsePublication(await readXml(response, aborted), date);
      return { year: Number(year), month: Number(month), date, value, source };
    } catch (error) {
      if (error instanceof TcmbError) throw error;
      throw new TcmbError("UPSTREAM_ERROR", undefined, error);
    } finally {
      clearTimeout(timer);
      combined.removeEventListener("abort", onAbort);
    }
  }

  async function loadMonth(
    year: number,
    month: number,
    asOf?: string,
  ): Promise<RatePoint> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MONTH_TIMEOUT_MS);
    const cursor = asOf
      ? new Date(`${asOf}T00:00:00Z`)
      : new Date(Date.UTC(year, month, 0));
    let attempts = 0;
    try {
      while (
        cursor.getUTCMonth() === month - 1 &&
        attempts < MAX_PUBLICATION_ATTEMPTS
      ) {
        if (controller.signal.aborted) throw new TcmbError("UPSTREAM_ERROR");
        if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) {
          attempts += 1;
          const result = await publication(
            cursor.toISOString().slice(0, 10),
            controller.signal,
          );
          if (result) return result;
        }
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      throw new TcmbError("RATE_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }

  function monthKey(year: number, month: number, asOf?: string): string {
    return `${year}-${month}${asOf ? `:${asOf}` : ""}`;
  }

  function monthRate(
    year: number,
    month: number,
    asOf?: string,
    timestamp?: number,
  ): Promise<RatePoint> {
    const key = monthKey(year, month, asOf);
    const hit = cached(key, timestamp);
    if (hit) return Promise.resolve(hit);
    const inflight = pending.get(key);
    if (inflight) return inflight;
    activeMonths += 1;
    const result = loadMonth(year, month, asOf)
      .then((rate) => {
        const ttl = asOf ? CURRENT_MONTH_CACHE_TTL_MS : CACHE_TTL_MS;
        cache.set(key, { rate, expiresAt: (timestamp ?? now()) + ttl });
        if (cache.size > MAX_CACHE_ENTRIES)
          cache.delete(cache.keys().next().value!);
        return rate;
      })
      .finally(() => {
        activeMonths -= 1;
        pending.delete(key);
      });
    pending.set(key, result);
    return result;
  }

  async function getQuarterRates(
    year: number,
    month: PaymentMonth,
  ): Promise<RatesResponse> {
    // Validate this boundary too: a caller cannot turn the fixed upstream URL into arbitrary input.
    if (
      !Number.isInteger(year) ||
      year < 2006 ||
      year > 2100 ||
      ![1, 4, 7, 10].includes(month)
    ) {
      throw new TcmbError("INVALID_PERIOD");
    }
    const periods = [3, 2, 1].map((offset) => {
      const date = new Date(Date.UTC(year, month - 1 - offset, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    });
    const needed = periods.filter(({ year, month }) => {
      const key = `${year}-${month}`;
      return !cached(key) && !pending.has(key);
    }).length;
    // Reserve all needed chains synchronously; a saturated quarter starts no partial requests.
    if (activeMonths + needed > MAX_ACTIVE_MONTHS) throw new TcmbError("BUSY");
    const rates = await Promise.all(
      periods.map(({ year, month }) => monthRate(year, month)),
    );
    return {
      year,
      month,
      kind: "ForexBuying",
      rates: rates.map((rate) => ({ ...rate })) as RatesResponse["rates"],
    };
  }

  async function getScenarioRates(
    year: number,
    month: PaymentMonth,
  ): Promise<ScenarioRatesResponse> {
    if (
      !Number.isInteger(year) ||
      year < 2006 ||
      year > 2100 ||
      !isPaymentMonth(month)
    ) {
      throw new TcmbError("INVALID_PERIOD");
    }
    // One snapshot keeps availability, publication cutoff and cache age consistent across midnight.
    const timestamp = now();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(timestamp));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((value) => value.type === type)!.value;
    const asOf = `${part("year")}-${part("month")}-${part("day")}`;
    const currentMonth = Number(part("year")) * 12 + Number(part("month"));
    const periods = getReferenceMonths(year, month).map((period) => {
      const ordinal = period.year * 12 + period.month;
      return {
        ...period,
        future: ordinal > currentMonth,
        cutoff: ordinal === currentMonth ? asOf : undefined,
      };
    });
    const needed = periods.filter(({ year, month, future, cutoff }) => {
      if (future) return false;
      const key = monthKey(year, month, cutoff);
      return !cached(key, timestamp) && !pending.has(key);
    }).length;
    if (activeMonths + needed > MAX_ACTIVE_MONTHS) throw new TcmbError("BUSY");

    const rates = await Promise.all(
      periods.map(async ({ year, month, future, cutoff }): Promise<ScenarioRate> => {
        if (future) return { year, month, status: "unavailable", rate: null };
        try {
          const rate = await monthRate(year, month, cutoff, timestamp);
          return {
            year,
            month,
            status: cutoff ? "partial" : "complete",
            rate: { ...rate },
          };
        } catch (cause) {
          if (cause instanceof TcmbError && cause.code === "RATE_UNAVAILABLE")
            return { year, month, status: "unavailable", rate: null };
          return {
            year,
            month,
            status: "error",
            rate: null,
            error: cause instanceof TcmbError ? cause.code : "UPSTREAM_ERROR",
          };
        }
      }),
    );
    return {
      year,
      month,
      kind: "ForexBuying",
      asOf,
      rates: rates as ScenarioRatesResponse["rates"],
    };
  }

  return { getQuarterRates, getScenarioRates };
}

const defaultClient = createTcmbClient();
export const getQuarterRates = defaultClient.getQuarterRates;
export const getScenarioRates = defaultClient.getScenarioRates;
