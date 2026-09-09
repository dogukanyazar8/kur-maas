import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getQuarterRates } from "../../../lib/tcmb";

vi.mock("../../../lib/tcmb", () => ({
  getQuarterRates: vi.fn(),
  TcmbError: class extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
}));

beforeEach(() => vi.resetAllMocks());

describe("read-only rates API boundary", () => {
  it.each([
    "year=2026&month=2",
    "year=2026x&month=7",
    "year=1990&month=7",
    "year=2026&month=7&salary=1000",
    "year=2026&year=2025&month=7",
    "year=2026",
  ])("rejects unsupported query %s before network access", async (query) => {
    const response = await GET(
      new Request(`http://localhost/api/rates?${query}`),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_PERIOD" });
    expect(getQuarterRates).not.toHaveBeenCalled();
  });
  it("rejects a future quarter without pretending its latest known day is month-end", async () => {
    const response = await GET(
      new Request("http://localhost/api/rates?year=2100&month=10"),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "INCOMPLETE_PERIOD" });
    expect(getQuarterRates).not.toHaveBeenCalled();
  });
  it("returns only safe error codes when upstream fails", async () => {
    vi.mocked(getQuarterRates).mockRejectedValue(
      new Error("internal infrastructure secret"),
    );
    const response = await GET(
      new Request("http://localhost/api/rates?year=2025&month=7"),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "UPSTREAM_ERROR" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
