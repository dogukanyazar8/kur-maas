export type PaymentMonth = 1 | 4 | 7 | 10;
export type RatePoint = {
  year: number;
  month: number;
  date: string;
  value: string;
  source: string;
};
export type RatesResponse = {
  year: number;
  month: PaymentMonth;
  kind: "ForexBuying";
  rates: [RatePoint, RatePoint, RatePoint];
};
export type ApiErrorCode =
  | "INVALID_PERIOD"
  | "INCOMPLETE_PERIOD"
  | "RATE_UNAVAILABLE"
  | "UPSTREAM_ERROR"
  | "BUSY";
export type ApiError = { error: ApiErrorCode };
export type ScenarioRate =
  | { year: number; month: number; status: "complete" | "partial"; rate: RatePoint }
  | { year: number; month: number; status: "unavailable"; rate: null }
  | { year: number; month: number; status: "error"; rate: null; error: ApiErrorCode };
export type ScenarioRatesResponse = {
  year: number;
  month: PaymentMonth;
  kind: "ForexBuying";
  asOf: string;
  rates: [ScenarioRate, ScenarioRate, ScenarioRate];
};
