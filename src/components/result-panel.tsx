import {
  ArrowUpRight,
  Calculator,
  Printer,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { formatDecimal, type NumberLocale } from "../lib/numbers";
import { monthLabel } from "../lib/periods";
import type { SalaryResult } from "../lib/calculator";
import type { Copy, Language } from "../lib/i18n";
import type { RatePoint } from "../lib/contracts";

export type Calculation = {
  result: SalaryResult;
  salary: string;
  currentRate: string;
  year: number;
  month: number;
  mode: "official" | "scenario";
  rates: RatePoint[];
};

export function ResultPanel({
  calculation,
  locale,
  language,
  t,
  onCarry,
}: {
  calculation: Calculation | null;
  locale: NumberLocale;
  language: Language;
  t: Copy;
  onCarry: () => void;
}) {
  const money = (value: string) => formatDecimal(value, locale, 2);
  const rate = (value: string) => formatDecimal(value, locale, 4);
  return (
    <section
      className={`result-panel ${calculation ? "has-result" : ""}`}
      aria-label={t.result}
      data-testid="result"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="result-topline">
        <span>
          <span className="status-dot" />
          {t.result}
        </span>
        <Wallet size={21} aria-hidden="true" />
      </div>
      {calculation ? (
        <>
          <div className="result-period">
            {monthLabel(calculation.year, calculation.month, language)}{" "}
            {calculation.year}
            <span className="result-badge">
              {calculation.mode === "scenario"
                ? t.scenario
                : calculation.result.averageRate === null
                  ? t.ordinary
                  : t.verified}
            </span>
          </div>
          <p className="total-label">{t.total}</p>
          <div className="total-amount">
            <span data-testid="total">{money(calculation.result.total)}</span>
            <span className="total-currency">TL</span>
          </div>
          <div className="result-breakdown">
            <div>
              <span className="breakdown-icon">
                <Wallet size={18} aria-hidden="true" />
              </span>
              <div>
                <span>{t.base}</span>
                <small>
                  {money(calculation.salary)} USD ×{" "}
                  {rate(calculation.result.effectiveRate)}
                </small>
              </div>
              <strong data-testid="base">
                {money(calculation.result.baseSalary)} <small>TL</small>
              </strong>
            </div>
            <div>
              <span className="breakdown-icon accent">
                <ArrowUpRight size={20} aria-hidden="true" />
              </span>
              <div>
                <span>{t.adjustment}</span>
                <small>
                  {money(calculation.salary)} ×{" "}
                  {rate(calculation.result.rateDifference)} × 3
                </small>
              </div>
              <strong className="extra-amount" data-testid="adjustment">
                +{money(calculation.result.adjustment)} <small>TL</small>
              </strong>
            </div>
          </div>
          <div className="effective-rate">
            <div>
              <span>{t.newRate}</span>
              <strong>
                {rate(calculation.result.effectiveRate)} <small>TL / USD</small>
              </strong>
            </div>
            <ArrowUpRight size={28} aria-hidden="true" />
            <p>{t.futureRate}</p>
          </div>
          <div className="protection-note">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>
                {calculation.result.protected ? t.protected : t.rateRule}
              </strong>
              {calculation.result.protected && <p>{t.protectedHint}</p>}
            </div>
          </div>
          {calculation.mode === "scenario" && (
            <p className="scenario-note">{t.scenarioWarning}</p>
          )}
          {calculation.result.averageRate !== null && (
            <button className="carry-button" onClick={onCarry}>
              {t.carry}
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          )}
          <button className="print-button" onClick={() => window.print()}>
            <Printer size={15} aria-hidden="true" />
            {t.print}
          </button>
        </>
      ) : (
        <div className="empty-result">
          <div className="empty-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="art-currency dollar">$</span>
            <span className="art-center">
              <Calculator size={36} strokeWidth={1.5} />
            </span>
            <span className="art-currency lira">₺</span>
          </div>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyHint}</p>
          <div className="empty-equation">
            <span>USD</span>
            <span>×</span>
            <span>TRY</span>
            <span>+</span>
            <span>{language === "tr" ? "Kur farkı" : "Adjustment"}</span>
          </div>
          <div className="empty-protection">
            <ShieldCheck size={17} aria-hidden="true" />
            {t.rateRule}
          </div>
        </div>
      )}
    </section>
  );
}
