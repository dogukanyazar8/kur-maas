import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getScenarioRates, TcmbError } from "../../../lib/tcmb";
import type { ScenarioRatesResponse } from "../../../lib/contracts";

vi.mock("../../../lib/tcmb", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../lib/tcmb")>(),
  getScenarioRates: vi.fn(),
}));

beforeEach(() => vi.resetAllMocks());

describe("scenario rates API boundary", () => {
  it.each([
    "year=2026&month=2",
    "year=2026x&month=7",
    "year=2026.0&month=7",
    "year=%202026&month=7",
    "year=2005&month=7",
    "year=2101&month=7",
    "year=2026&month=07",
    "year=2026&month=7&salary=1000",
    "year=2026&month=7&asOf=2100-01-01",
    "year=2026&year=2025&month=7",
    "year=2026&month=7&month=10",
    "year=2026",
    "month=7",
    "",
  ])("rejects invalid query %s before upstream access", async (query) => {
    const response = await GET(new Request(`http://localhost/api/scenario-rates?${query}`));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_PERIOD" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getScenarioRates).not.toHaveBeenCalled();
  });

  it("accepts a future payment period and returns unavailable months without public caching", async () => {
    const result: ScenarioRatesResponse = {
      year: 2100,
      month: 1,
      kind: "ForexBuying",
      asOf: "2026-09-08",
      rates: [
        { year: 2099, month: 10, status: "unavailable", rate: null },
        { year: 2099, month: 11, status: "unavailable", rate: null },
        { year: 2099, month: 12, status: "unavailable", rate: null },
      ],
    };
    vi.mocked(getScenarioRates).mockResolvedValue(result);
    const response = await GET(new Request("http://localhost/api/scenario-rates?year=2100&month=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(getScenarioRates).toHaveBeenCalledWith(2100, 1);
  });

  it("keeps successful month data when another month contains a safe error", async () => {
    const result: ScenarioRatesResponse = {
      year: 2026,
      month: 10,
      kind: "ForexBuying",
      asOf: "2026-08-03",
      rates: [
        {
          year: 2026,
          month: 7,
          status: "complete",
          rate: {
            year: 2026,
            month: 7,
            date: "2026-07-31",
            value: "47.3452",
            source: "https://www.tcmb.gov.tr/kurlar/202607/31072026.xml",
          },
        },
        { year: 2026, month: 8, status: "error", rate: null, error: "UPSTREAM_ERROR" },
        { year: 2026, month: 9, status: "unavailable", rate: null },
      ],
    };
    vi.mocked(getScenarioRates).mockResolvedValue(result);
    const response = await GET(new Request("http://localhost/api/scenario-rates?year=2026&month=10"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
  });

  it.each([
    [new TcmbError("BUSY"), "BUSY", 503],
    [new TcmbError("UPSTREAM_ERROR", 503), "UPSTREAM_ERROR", 502],
    [new Error("internal infrastructure secret"), "UPSTREAM_ERROR", 502],
  ])("returns safe errors for a rejected scenario request", async (cause, code, status) => {
    vi.mocked(getScenarioRates).mockRejectedValue(cause);
    const response = await GET(new Request("http://localhost/api/scenario-rates?year=2026&month=10"));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
