"use client";

import { useEffect, useRef, useState } from "react";
import type { ScenarioRatesResponse } from "../lib/contracts";
import {
  formatDecimal,
  reformatInput,
  type NumberLocale,
} from "../lib/numbers";
import { isPaymentMonth } from "../lib/periods";

export function useScenarioRates(onAutofill: () => void) {
  const [values, setValues] = useState(["", "", ""]);
  const [data, setData] = useState<ScenarioRatesResponse | null>(null);
  const [edited, setEdited] = useState([false, false, false]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const dirty = useRef([false, false, false]);
  const locale = useRef<NumberLocale>("tr-TR");
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  function cancel() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
  }

  function clear() {
    cancel();
    setValues(["", "", ""]);
    setData(null);
    dirty.current = [false, false, false];
    setEdited(dirty.current);
    setFailed(false);
  }

  function update(index: number, value: string) {
    dirty.current = dirty.current.map((item, i) => i === index || item);
    setEdited(dirty.current);
    setValues((previous) =>
      previous.map((item, i) => (i === index ? value : item)),
    );
  }

  function example() {
    clear();
    dirty.current = [true, true, true];
    setEdited(dirty.current);
    setValues(["44", "45", "46"]);
  }

  function reformat(next: NumberLocale) {
    const previous = locale.current;
    locale.current = next;
    setValues((items) =>
      items.map((value) => reformatInput(value, previous, next, 4)),
    );
  }

  async function load(year: string, month: number, reset = false) {
    if (reset) clear();
    else cancel();
    if (
      !/^\d{4}$/.test(year) ||
      Number(year) < 2006 ||
      Number(year) > 2100 ||
      !isPaymentMonth(month)
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/scenario-rates?year=${year}&month=${month}`,
        {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
          cache: "no-store",
        },
      );
      if (!response.ok)
        throw new Error(`Scenario rates: HTTP ${response.status}`);
      const result = (await response.json()) as ScenarioRatesResponse;
      if (request.current !== controller) return;
      setData(result);
      setFailed(result.rates.some((item) => item.status === "error"));
      setValues((previous) =>
        previous.map((value, index) => {
          if (dirty.current[index]) return value;
          const point = result.rates[index].rate;
          return point ? formatDecimal(point.value, locale.current, 4) : "";
        }),
      );
      if (dirty.current.some((item) => !item)) onAutofill();
    } catch {
      if (request.current === controller) setFailed(true);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  return {
    values,
    data,
    edited,
    loading,
    failed,
    update,
    reformat,
    clear,
    cancel,
    example,
    load,
  };
}
