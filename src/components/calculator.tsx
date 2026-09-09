"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Globe2,
  Info,
  Landmark,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { calculateSalary } from "../lib/calculator";
import {
  formatDecimal,
  parseLocalizedDecimal,
  reformatInput,
  type NumberLocale,
} from "../lib/numbers";
import {
  dateLabel,
  getReferenceMonths,
  isCompletePeriod,
  isPaymentMonth,
  monthLabel,
  type YearMonth,
} from "../lib/periods";
import { translations, type Language } from "../lib/i18n";
import type { ApiError, RatesResponse, RatePoint } from "../lib/contracts";
import { ResultPanel, type Calculation } from "./result-panel";
import { AppSelect } from "./app-select";
import { useScenarioRates } from "./use-scenario-rates";

const subscribeHydration = () => () => {};

type ErrorKey =
  | "errorNumber"
  | "errorPeriod"
  | "errorUpstream"
  | "errorIncomplete"
  | "errorUnavailable"
  | "errorBusy";
const errorKeys: Record<ApiError["error"], ErrorKey> = {
  INVALID_PERIOD: "errorPeriod",
  INCOMPLETE_PERIOD: "errorIncomplete",
  RATE_UNAVAILABLE: "errorUnavailable",
  UPSTREAM_ERROR: "errorUpstream",
  BUSY: "errorBusy",
};

export default function SalaryCalculator({
  initialPeriod,
}: {
  initialPeriod: YearMonth;
}) {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const [language, setLanguage] = useState<Language>("tr");
  const [locale, setLocale] = useState<NumberLocale>("tr-TR");
  const [salary, setSalary] = useState("");
  const [currentRate, setCurrentRate] = useState("");
  // Keep the precise carried rate until the user explicitly edits its short display.
  const [carriedRate, setCarriedRate] = useState<string | null>(null);
  const [year, setYear] = useState(String(initialPeriod.year));
  const [month, setMonth] = useState(
    Math.floor((initialPeriod.month - 1) / 3) * 3 + 1,
  );
  const [mode, setMode] = useState<"official" | "scenario">("official");
  const scenario = useScenarioRates(invalidate);
  const manualRates = scenario.values;
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const t = translations[language];
  const quarter = isPaymentMonth(month);
  const validYear =
    /^\d{4}$/.test(year) && Number(year) >= 2006 && Number(year) <= 2100;
  const references =
    quarter && validYear ? getReferenceMonths(Number(year), month) : [];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => () => request.current?.abort(), []);

  function invalidate() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setCalculation(null);
    setError(null);
  }

  function changeLocale(next: NumberLocale) {
    setSalary(reformatInput(salary, locale, next, 2));
    setCurrentRate(
      carriedRate === null
        ? reformatInput(currentRate, locale, next, 50)
        : formatDecimal(carriedRate, next, 4),
    );
    scenario.reformat(next);
    setLocale(next);
  }

  function scenarioPoints(
    values: string[],
    selectedYear: number,
    selectedMonth: number,
    useSources = true,
  ): RatePoint[] {
    return getReferenceMonths(selectedYear, selectedMonth).map((period, i) => {
      const source =
        useSources &&
        !scenario.edited[i] &&
        scenario.data?.year === selectedYear &&
        scenario.data?.month === selectedMonth
          ? scenario.data.rates[i].rate
          : null;
      return {
        ...period,
        date: source?.date ?? "",
        source: source?.source ?? "",
        value: values[i],
      };
    });
  }

  function changePeriod(nextYear: string, nextMonth: number) {
    invalidate();
    setYear(nextYear);
    setMonth(nextMonth);
    if (mode === "scenario") void scenario.load(nextYear, nextMonth, true);
    else scenario.clear();
  }

  function draftPoint(index: number): RatePoint | undefined {
    if (mode !== "scenario" || !references[index]) return undefined;
    try {
      const value = parseLocalizedDecimal(manualRates[index], locale, 4);
      const source = !scenario.edited[index]
        ? scenario.data?.rates[index].rate
        : null;
      return {
        ...references[index],
        value,
        date: source?.date ?? "",
        source: source?.source ?? "",
      };
    } catch {
      return undefined;
    }
  }

  function runExample() {
    invalidate();
    setSalary(formatDecimal("1000", locale, 0));
    setCurrentRate("43");
    setCarriedRate(null);
    setYear("2026");
    setMonth(7);
    setMode("scenario");
    scenario.example();
    setCalculation({
      result: calculateSalary("1000", "43", ["44", "45", "46"]),
      salary: "1000",
      currentRate: "43",
      year: 2026,
      month: 7,
      mode: "scenario",
      rates: scenarioPoints(["44", "45", "46"], 2026, 7, false),
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invalidate();
    if (!validYear || !Number.isInteger(month) || month < 1 || month > 12) {
      setError("errorPeriod");
      return;
    }
    let usd: string;
    let base: string;
    let entered: [string, string, string] | undefined;
    try {
      usd = parseLocalizedDecimal(salary, locale, 2);
      base = carriedRate ?? parseLocalizedDecimal(currentRate, locale, 50);
      if (quarter && mode === "scenario")
        entered = manualRates.map((value) =>
          parseLocalizedDecimal(value, locale, 4),
        ) as [string, string, string];
      calculateSalary(usd, base, entered);
    } catch {
      setError("errorNumber");
      return;
    }
    const selectedYear = Number(year);
    if (!quarter || entered) {
      setCalculation({
        result: calculateSalary(usd, base, entered),
        salary: usd,
        currentRate: base,
        year: selectedYear,
        month,
        mode:
          selectedYear * 12 + month >
          initialPeriod.year * 12 + initialPeriod.month
            ? "scenario"
            : mode,
        rates: entered ? scenarioPoints(entered, selectedYear, month) : [],
      });
      return;
    }
    if (!isCompletePeriod(selectedYear, month)) {
      setError("errorIncomplete");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/rates?year=${selectedYear}&month=${month}`,
        {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
        },
      );
      if (!response.ok) {
        const failure = (await response.json()) as ApiError;
        if (!controller.signal.aborted)
          setError(errorKeys[failure.error] ?? "errorUpstream");
        return;
      }
      const data = (await response.json()) as RatesResponse;
      if (controller.signal.aborted) return;
      const rates = data.rates.map((point) => point.value) as [
        string,
        string,
        string,
      ];
      setCalculation({
        result: calculateSalary(usd, base, rates),
        salary: usd,
        currentRate: base,
        year: selectedYear,
        month,
        mode: "official",
        rates: data.rates,
      });
    } catch {
      if (!controller.signal.aborted) setError("errorUpstream");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  function carryToNextMonth() {
    if (!calculation || calculation.result.averageRate === null) return;
    const effectiveRate = calculation.result.effectiveRate;
    const nextMonth = calculation.month + 1;
    const carriedMode =
      calculation.year * 12 + nextMonth >
      initialPeriod.year * 12 + initialPeriod.month
        ? "scenario"
        : calculation.mode;
    invalidate();
    scenario.clear();
    setCarriedRate(effectiveRate);
    setCurrentRate(formatDecimal(effectiveRate, locale, 4));
    setMonth(nextMonth);
    setMode(carriedMode);
    setCalculation({
      ...calculation,
      mode: carriedMode,
      currentRate: effectiveRate,
      month: nextMonth,
      rates: [],
      result: calculateSalary(calculation.salary, effectiveRate),
    });
  }

  const formatNames: Record<NumberLocale, string> = {
    "tr-TR": "TR · 1.234,56",
    "en-US": "US · 1,234.56",
    "de-DE": "DE · 1.234,56",
    "fr-FR": "FR · 1 234,56",
  };
  return (
    <>
      <a className="skip-link" href="#calculator">
        {t.skip}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="Kur Maaş">
            <svg
              className="brand-symbol"
              width="40"
              height="40"
              viewBox="0 0 40 40"
              aria-hidden="true"
            >
              <rect
                x="0.5"
                y="0.5"
                width="39"
                height="39"
                rx="12"
                fill="currentColor"
              />
              <rect
                x="2"
                y="2"
                width="36"
                height="36"
                rx="10.5"
                fill="none"
                stroke="#ffffff"
                strokeOpacity=".12"
              />
              <path
                d="M12.5 10.5V28M13 22L23.5 14.5M17.5 19L24 28"
                fill="none"
                stroke="#f7faef"
                strokeWidth="3.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="30" cy="27.6" r="2.3" fill="#d8ed9b" />
            </svg>
            <span>
              kur<span className="brand-light">maaş</span>
              <span className="brand-dot">.</span>
            </span>
          </a>
          <nav aria-label={language === "tr" ? "Ana menü" : "Main navigation"}>
            <a className="nav-active" href="#calculator">
              {t.calculator}
            </a>
            <a href="#how-it-works">{t.how}</a>
          </nav>
          <div className="preferences">
            <AppSelect
              compact
              disabled={!hydrated}
              label={t.language}
              value={language}
              onValueChange={(value) => setLanguage(value as Language)}
              icon={<Globe2 size={15} />}
              options={[
                { value: "tr", label: "Türkçe" },
                { value: "en", label: "English" },
              ]}
            />
            <span className="preferences-divider" />
            <AppSelect
              compact
              disabled={!hydrated}
              label={t.numberFormat}
              value={locale}
              onValueChange={(value) => changeLocale(value as NumberLocale)}
              options={Object.entries(formatNames).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>
        </div>
      </header>
      <main className="page-shell">
        <noscript>
          <p className="error-message">
            Hesaplayıcı için tarayıcında JavaScript etkin olmalı. / Enable
            JavaScript to use this calculator.
          </p>
        </noscript>
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span />
              {t.eyebrow}
            </div>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>
          <div className="privacy-callout">
            <span className="privacy-icon">
              <LockKeyhole size={21} aria-hidden="true" />
            </span>
            <div>
              <strong>{t.private}</strong>
              <p>{t.privateDetail}</p>
            </div>
          </div>
        </section>
        <div className="calculator-grid" id="calculator">
          <section className="input-card" aria-labelledby="form-title">
            <div className="section-heading">
              <div>
                <h2 id="form-title">{t.formTitle}</h2>
                <p>{t.formSubtitle}</p>
              </div>
              <span className="section-number">01</span>
            </div>
            <form onSubmit={submit} noValidate>
              <fieldset className="form-body" disabled={!hydrated}>
                <div className="field">
                  <label htmlFor="salary">{t.salary}</label>
                  <div className="input-wrap">
                    <span className="input-prefix">$</span>
                    <input
                      id="salary"
                      autoComplete="off"
                      inputMode="decimal"
                      maxLength={32}
                      placeholder={
                        locale === "en-US"
                          ? "e.g. 1,000"
                          : language === "tr"
                            ? "Örn. 1.000"
                            : "e.g. 1.000"
                      }
                      aria-describedby="salary-hint"
                      value={salary}
                      onChange={(event) => {
                        invalidate();
                        setSalary(event.target.value);
                      }}
                    />
                    <span className="input-unit">USD</span>
                  </div>
                  <p className="field-hint" id="salary-hint">
                    {t.salaryHint}
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="current-rate">{t.currentRate}</label>
                  <div className="input-wrap">
                    <span className="input-prefix">₺</span>
                    <input
                      id="current-rate"
                      autoComplete="off"
                      inputMode="decimal"
                      maxLength={96}
                      placeholder={locale === "en-US" ? "43.0000" : "43,0000"}
                      aria-describedby="rate-hint"
                      value={currentRate}
                      onChange={(event) => {
                        invalidate();
                        setCarriedRate(null);
                        setCurrentRate(event.target.value);
                      }}
                    />
                    <span className="input-unit">TL / USD</span>
                  </div>
                  <p className="field-hint" id="rate-hint">
                    {t.rateHint}
                  </p>
                </div>
                <div className="period-fields">
                  <div className="field">
                    <label htmlFor="month">{t.month}</label>
                    <AppSelect
                      id="month"
                      label={t.month}
                      disabled={!hydrated}
                      value={String(month)}
                      onValueChange={(value) =>
                        changePeriod(year, Number(value))
                      }
                      icon={<CalendarDays size={16} />}
                      options={Array.from({ length: 12 }, (_, i) => ({
                        value: String(i + 1),
                        label: monthLabel(2026, i + 1, language),
                        badge: isPaymentMonth(i + 1) ? t.quarterly : undefined,
                      }))}
                    />
                  </div>
                  <div className="field year-field">
                    <label htmlFor="year">{t.year}</label>
                    <input
                      id="year"
                      inputMode="numeric"
                      maxLength={4}
                      value={year}
                      onChange={(event) => {
                        changePeriod(event.target.value, month);
                      }}
                    />
                  </div>
                </div>
                <div className={`period-note ${quarter ? "quarter-note" : ""}`}>
                  <span className="status-dot" />
                  {quarter ? t.quarterly : t.ordinary}
                </div>
                {quarter ? (
                  <fieldset className="source-fieldset">
                    <legend>{t.source}</legend>
                    <div className="source-toggle">
                      <button
                        type="button"
                        aria-pressed={mode === "official"}
                        onClick={() => {
                          invalidate();
                          scenario.cancel();
                          setMode("official");
                        }}
                      >
                        <Landmark size={16} aria-hidden="true" />
                        {t.official}
                        {mode === "official" && (
                          <Check size={14} aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-pressed={mode === "scenario"}
                        onClick={() => {
                          invalidate();
                          setMode("scenario");
                          void scenario.load(year, month);
                        }}
                      >
                        {t.scenario}
                        {mode === "scenario" && (
                          <Check size={14} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <p className="field-hint">
                      {mode === "official" ? t.officialHint : t.scenarioHint}
                    </p>
                    {mode === "scenario" && (
                      <>
                        <p
                          className={`scenario-status ${scenario.failed ? "scenario-status-error" : ""}`}
                          role="status"
                          data-testid="scenario-status"
                        >
                          {scenario.loading
                            ? t.calculating
                            : scenario.failed
                              ? t.scenarioLoadError
                              : scenario.data
                                ? `${t.scenarioAsOf} ${dateLabel(scenario.data.asOf, language)}`
                                : t.scenarioEditable}
                        </p>
                        <div className="manual-rates">
                          {references.map((period, i) => (
                            <div
                              className="field"
                              key={`${period.year}-${period.month}`}
                            >
                              <label htmlFor={`manual-${i}`}>
                                {monthLabel(
                                  period.year,
                                  period.month,
                                  language,
                                  true,
                                )}
                              </label>
                              <input
                                id={`manual-${i}`}
                                data-testid={`manual-${i}`}
                                inputMode="decimal"
                                autoComplete="off"
                                maxLength={32}
                                placeholder="0"
                                aria-describedby={`scenario-reference-${i}`}
                                value={manualRates[i]}
                                onChange={(event) => {
                                  invalidate();
                                  scenario.update(i, event.target.value);
                                }}
                              />
                              <p
                                className="scenario-reference"
                                id={`scenario-reference-${i}`}
                                data-testid={`scenario-reference-${i}`}
                              >
                                <span>
                                  {scenario.edited[i]
                                    ? t.scenarioEdited
                                    : scenario.data?.rates[i].status ===
                                        "partial"
                                      ? t.scenarioPartial
                                      : scenario.data?.rates[i].status ===
                                          "complete"
                                        ? t.scenarioComplete
                                        : scenario.data?.rates[i].status ===
                                            "error"
                                          ? t.scenarioRateError
                                          : scenario.loading
                                            ? t.scenarioLoading
                                            : t.scenarioUnavailable}
                                </span>
                                {scenario.data?.rates[i].rate && (
                                  <span>
                                    {dateLabel(
                                      scenario.data.rates[i].rate.date,
                                      language,
                                    )}
                                  </span>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </fieldset>
                ) : (
                  <p className="ordinary-info">
                    <Info size={17} aria-hidden="true" />
                    {t.ordinaryHint}
                  </p>
                )}
                {error && (
                  <div className="error-message" role="alert">
                    <Info size={18} aria-hidden="true" />
                    <span>{t[error]}</span>
                  </div>
                )}
                <button
                  className="calculate-button"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? t.calculating : t.calculate}
                  {busy ? (
                    <span className="spinner" />
                  ) : (
                    <ArrowRight size={19} aria-hidden="true" />
                  )}
                </button>
                <div className="form-actions">
                  <button type="button" onClick={runExample}>
                    {t.example}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      invalidate();
                      setSalary("");
                      setCurrentRate("");
                      setCarriedRate(null);
                      scenario.clear();
                      setMode("official");
                    }}
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    {t.reset}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
          <ResultPanel
            onCarry={carryToNextMonth}
            calculation={calculation}
            locale={locale}
            language={language}
            t={t}
          />
        </div>
        <section className="rates-card" aria-labelledby="rates-title">
          <div className="rates-heading">
            <div>
              <span className="eyebrow compact">{t.referencePeriod}</span>
              <h2 id="rates-title">{t.monthsTitle}</h2>
            </div>
            <span className="source-badge">
              <Landmark size={14} aria-hidden="true" />
              {!quarter
                ? t.ordinary
                : mode === "scenario"
                  ? t.scenario
                  : "TCMB / USD"}
            </span>
          </div>
          {quarter && references.length > 0 ? (
            <>
              <p className="rates-description">{t.monthsHint}</p>
              <div className="rates-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t.referenceMonth}</th>
                      <th scope="col">{t.lastDate}</th>
                      <th scope="col">
                        {mode === "scenario" ? t.manualRate : t.buyingRate}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {references.map((period, i) => {
                      const point = calculation?.rates[i] ?? draftPoint(i);
                      return (
                        <tr key={`${period.year}-${period.month}`}>
                          <th scope="row">
                            <span className="month-marker">
                              {String(period.month).padStart(2, "0")}
                            </span>
                            {monthLabel(period.year, period.month, language)}{" "}
                            <span className="year-muted">{period.year}</span>
                          </th>
                          <td>
                            {point ? (
                              point.source ? (
                                <a
                                  href={point.source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {dateLabel(point.date, language)}
                                  {mode === "scenario" &&
                                    scenario.data?.rates[i].status ===
                                      "partial" && (
                                      <span className="partial-tag">
                                        {t.scenarioPartial}
                                      </span>
                                    )}
                                  <ArrowUpRight size={13} aria-hidden="true" />
                                </a>
                              ) : (
                                <span>{t.manual}</span>
                              )
                            ) : (
                              <span className="not-loaded">
                                {mode === "scenario" ? t.manual : t.notLoaded}
                              </span>
                            )}
                          </td>
                          <td className="table-rate">
                            {point
                              ? `${formatDecimal(point.value, locale, 4)} TL`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {calculation?.result.averageRate && (
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={2}>
                          {t.average}
                        </th>
                        <td>
                          {formatDecimal(
                            calculation.result.averageRate,
                            locale,
                            4,
                          )}{" "}
                          TL
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <div className="rates-footnote">
                <Info size={14} aria-hidden="true" />
                {t.precision}
              </div>
            </>
          ) : (
            <p className="rates-description">
              {validYear ? t.noRates : t.errorPeriod}
            </p>
          )}
        </section>
        <section className="how-section" id="how-it-works">
          <div className="how-header">
            <span className="eyebrow compact">{t.how}</span>
            <h2>{t.howTitle}</h2>
            <p>{t.howIntro}</p>
          </div>
          <div className="steps">
            {(["step1", "step2", "step3"] as const).map((key, i) => (
              <article key={key}>
                <span className="step-number">0{i + 1}</span>
                <h3>{t[key]}</h3>
                <p>{t[`${key}Body`]}</p>
              </article>
            ))}
          </div>
          <div className="calculation-notes">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>
              {t.rounding}
              <br />
              {t.scope}
            </p>
          </div>
        </section>
        <footer>
          <span className="footer-brand">kurmaaş.</span>
          <span>{t.footer}</span>
          <a
            href="https://www.tcmb.gov.tr/kurlar/kurlar_tr.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.sourceLink}
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </footer>
      </main>
    </>
  );
}
