import { afterEach, describe, expect, it, vi } from "vitest";
import { createTcmbClient, TcmbError } from "./tcmb";

const AUGUST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>
<Tarih_Date Tarih="31.08.2026" Date="08/31/2026" Bulten_No="2026/162">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit><Isim>ABD DOLARI</Isim><CurrencyName>US DOLLAR</CurrencyName>
    <ForexBuying>48.1745</ForexBuying><ForexSelling>48.2613</ForexSelling>
    <BanknoteBuying>48.1408</BanknoteBuying><BanknoteSelling>48.3337</BanknoteSelling>
    <CrossRateUSD/><CrossRateOther/>
  </Currency>
  <Currency CrossOrder="1" Kod="AUD" CurrencyCode="AUD">
    <Unit>1</Unit><Isim>AVUSTRALYA DOLARI</Isim><CurrencyName>AUSTRALIAN DOLLAR</CurrencyName>
    <ForexBuying>34.4098</ForexBuying><ForexSelling>34.6342</ForexSelling>
    <BanknoteBuying>34.2515</BanknoteBuying><BanknoteSelling>34.8420</BanknoteSelling>
    <CrossRateUSD>1.3955</CrossRateUSD><CrossRateOther/>
  </Currency>
</Tarih_Date>`;

function fixtureFor(url: string, value = "48.1745"): string {
  const match = /\/(\d{2})(\d{2})(\d{4})\.xml$/.exec(url);
  if (!match) throw new Error(`Unexpected TCMB URL: ${url}`);
  const [, day, month, year] = match;
  return AUGUST_XML.replace("31.08.2026", `${day}.${month}.${year}`)
    .replace("08/31/2026", `${month}/${day}/${year}`)
    .replace("48.1745", value);
}

function upstream(
  respond: (
    url: string,
    init: RequestInit | undefined,
  ) => Response | Promise<Response> = (url) =>
    new Response(fixtureFor(url), {
      headers: { "content-type": "application/xml" },
    }),
) {
  return vi.fn<typeof fetch>(async (input, init) =>
    respond(String(input), init),
  );
}

afterEach(() => vi.useRealTimers());

describe("TCMB historical USD adapter", () => {
  it("returns chronological previous-quarter ForexBuying strings and dated source links", async () => {
    const fetch = upstream(
      (url) =>
        new Response(
          fixtureFor(
            url,
            {
              "07": "47.3452",
              "08": "48.1745",
              "09": "49.0000",
            }[url.slice(-10, -8)],
          ),
        ),
    );
    const result = await createTcmbClient({ fetch }).getQuarterRates(2026, 10);

    expect(result).toEqual({
      year: 2026,
      month: 10,
      kind: "ForexBuying",
      rates: [
        {
          year: 2026,
          month: 7,
          date: "2026-07-31",
          value: "47.3452",
          source: "https://www.tcmb.gov.tr/kurlar/202607/31072026.xml",
        },
        {
          year: 2026,
          month: 8,
          date: "2026-08-31",
          value: "48.1745",
          source: "https://www.tcmb.gov.tr/kurlar/202608/31082026.xml",
        },
        {
          year: 2026,
          month: 9,
          date: "2026-09-30",
          value: "49.0000",
          source: "https://www.tcmb.gov.tr/kurlar/202609/30092026.xml",
        },
      ],
    });
    for (const [url, init] of fetch.mock.calls) {
      expect(String(url)).toMatch(
        /^https:\/\/www\.tcmb\.gov\.tr\/kurlar\/2026\d{2}\/\d{8}\.xml$/,
      );
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("rolls January into the previous year and skips weekend month ends", async () => {
    const fetch = upstream();
    const result = await createTcmbClient({ fetch }).getQuarterRates(2026, 1);
    expect(result.rates.map(({ date }) => date)).toEqual([
      "2025-10-31",
      "2025-11-28",
      "2025-12-31",
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("moves backward only for missing publications, including the long May holiday", async () => {
    const requested: string[] = [];
    const fetch = upstream((url) => {
      requested.push(url);
      return url.includes("/202605/") && !url.endsWith("/25052026.xml")
        ? new Response(null, { status: 404 })
        : new Response(fixtureFor(url));
    });
    const result = await createTcmbClient({ fetch }).getQuarterRates(2026, 7);
    expect(result.rates.map(({ date }) => date)).toEqual([
      "2026-04-30",
      "2026-05-25",
      "2026-06-30",
    ]);
    expect(
      requested
        .filter((url) => url.includes("/202605/"))
        .map((url) => url.slice(-12)),
    ).toEqual([
      "29052026.xml",
      "28052026.xml",
      "27052026.xml",
      "26052026.xml",
      "25052026.xml",
    ]);
  });

  it.each([429, 500, 503])(
    "does not search an earlier date after upstream HTTP %s",
    async (status) => {
      const fetch = upstream(() => new Response(null, { status }));
      await expect(
        createTcmbClient({ fetch }).getQuarterRates(2026, 10),
      ).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status });
      expect(fetch).toHaveBeenCalledTimes(3);
    },
  );

  it("stops after ten unavailable business days per month", async () => {
    const fetch = upstream(() => new Response(null, { status: 404 }));
    await expect(
      createTcmbClient({ fetch }).getQuarterRates(2026, 10),
    ).rejects.toMatchObject({ code: "RATE_UNAVAILABLE" });
    await Promise.resolve();
    for (const month of ["202607", "202608", "202609"]) {
      const calls = fetch.mock.calls.filter(([url]) =>
        String(url).includes(`/${month}/`),
      );
      expect(calls).toHaveLength(10);
    }
  });

  const invalidXml: [string, (xml: string) => string][] = [
    [
      "wrong Turkish date",
      (xml) => xml.replace(/Tarih="[^"]+"/, 'Tarih="01.01.2000"'),
    ],
    [
      "wrong English date",
      (xml) => xml.replace(/Date="[^"]+"/, 'Date="01/01/2000"'),
    ],
    ["wrong unit", (xml) => xml.replace("<Unit>1</Unit>", "<Unit>100</Unit>")],
    ["missing USD", (xml) => xml.replaceAll("USD", "EUR")],
    [
      "conflicting currency code",
      (xml) => xml.replace('CurrencyCode="USD"', 'CurrencyCode="EUR"'),
    ],
    [
      "duplicated USD",
      (xml) =>
        xml.replace(
          "</Tarih_Date>",
          `${xml.match(/<Currency CrossOrder="0"[\s\S]*?<\/Currency>/)?.[0]}</Tarih_Date>`,
        ),
    ],
    ["malformed markup", (xml) => xml.replace("</Currency>", "</Broken>")],
    ["DTD declaration", (xml) => xml.replace("?>", "?><!DOCTYPE Tarih_Date>")],
    ["entity declaration", (xml) => `<!ENTITY attack "1">${xml}`],
    ["zero", (xml) => xml.replace("48.1745", "0")],
    ["negative", (xml) => xml.replace("48.1745", "-48.1745")],
    ["NaN", (xml) => xml.replace("48.1745", "NaN")],
    ["infinity", (xml) => xml.replace("48.1745", "Infinity")],
    ["exponent notation", (xml) => xml.replace("48.1745", "4.8e1")],
    ["localized comma", (xml) => xml.replace("48.1745", "48,1745")],
    ["excess precision", (xml) => xml.replace("48.1745", "48.17451")],
    ["nested value", (xml) => xml.replace("48.1745", "<Value>48.1745</Value>")],
    [
      "duplicated value",
      (xml) =>
        xml.replace(
          "</ForexBuying>",
          "</ForexBuying><ForexBuying>1</ForexBuying>",
        ),
    ],
  ];

  it.each(invalidXml)(
    "rejects %s as an upstream error",
    async (_, transform) => {
      const fetch = upstream((url) => new Response(transform(fixtureFor(url))));
      await expect(
        createTcmbClient({ fetch }).getQuarterRates(2026, 10),
      ).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    },
  );

  it("rejects a body exceeding 256 KiB even without Content-Length and cancels the stream", async () => {
    const canceled: number[] = [];
    const fetch = upstream(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(256 * 1024));
              controller.enqueue(new Uint8Array(1));
            },
            cancel() {
              canceled.push(1);
            },
          }),
        ),
    );
    await expect(
      createTcmbClient({ fetch }).getQuarterRates(2026, 10),
    ).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    expect(canceled.length).toBeGreaterThan(0);
  });

  it("rejects an excessive declared Content-Length before buffering", async () => {
    const fetch = upstream(
      () => new Response("", { headers: { "content-length": "262145" } }),
    );
    await expect(
      createTcmbClient({ fetch }).getQuarterRates(2026, 10),
    ).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  });

  it("aborts a stalled fetch within eight seconds and reports a provider error", async () => {
    vi.useFakeTimers();
    const fetch = upstream(
      (_, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    );
    const pending = createTcmbClient({ fetch }).getQuarterRates(2026, 10);
    const rejection = expect(pending).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
    await vi.advanceTimersByTimeAsync(8_000);
    await rejection;
    expect(fetch.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(
      true,
    );
  });

  it("also aborts when headers arrive but the response body stalls", async () => {
    vi.useFakeTimers();
    const canceled: number[] = [];
    const fetch = upstream(
      () =>
        new Response(
          new ReadableStream({
            cancel() {
              canceled.push(1);
            },
          }),
        ),
    );
    const pending = createTcmbClient({ fetch }).getQuarterRates(2026, 10);
    const rejection = expect(pending).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
    await vi.advanceTimersByTimeAsync(8_000);
    await rejection;
    expect(canceled).toHaveLength(3);
  });

  it("reports connection errors without interpreting them as missing dates", async () => {
    const fetch = upstream(() => {
      throw new TypeError("fetch failed");
    });
    await expect(
      createTcmbClient({ fetch }).getQuarterRates(2026, 10),
    ).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects malformed UTF-8 rather than replacing invalid source bytes", async () => {
    const fetch = upstream(() => new Response(new Uint8Array([0xc3, 0x28])));
    await expect(
      createTcmbClient({ fetch }).getQuarterRates(2026, 10),
    ).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  });

  it("decodes historical ISO-8859-9 XML containing actual Turkish non-ASCII bytes", async () => {
    const fetch = upstream((url) => {
      // TCMB's 2015-12-31 archive uses 0xDD for the dotted capital I in DANİMARKA.
      const xml = fixtureFor(url, "2.9181")
        .replace('encoding="UTF-8"', 'encoding="ISO-8859-9"')
        .replace(
          "</Tarih_Date>",
          `<Currency CrossOrder="2" Kod="DKK" CurrencyCode="DKK">
          <Unit>1</Unit><Isim>DANİMARKA KRONU</Isim><CurrencyName>DANISH KRONE</CurrencyName>
          <ForexBuying>0.42596</ForexBuying><ForexSelling>0.42806</ForexSelling>
          <BanknoteBuying>0.42566</BanknoteBuying><BanknoteSelling>0.42904</BanknoteSelling>
          <CrossRateUSD>6.8399</CrossRateUSD><CrossRateOther/>
        </Currency></Tarih_Date>`,
        );
      const bytes = Buffer.from(xml.replaceAll("İ", "\xDD"), "latin1");
      expect(bytes.includes(0xdd)).toBe(true);
      expect(() =>
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ).toThrow();
      return new Response(bytes);
    });
    const result = await createTcmbClient({ fetch }).getQuarterRates(2016, 1);
    expect(result.rates.map(({ date, value }) => ({ date, value }))).toEqual([
      { date: "2015-10-30", value: "2.9181" },
      { date: "2015-11-30", value: "2.9181" },
      { date: "2015-12-31", value: "2.9181" },
    ]);
  });

  it.each(["UTF-16", "windows-1254", "ISO-8859-1", "invalid-encoding"])(
    "rejects an unapproved XML encoding declaration: %s",
    async (encoding) => {
      const fetch = upstream(
        (url) =>
          new Response(
            fixtureFor(url).replace(
              'encoding="UTF-8"',
              `encoding="${encoding}"`,
            ),
          ),
      );
      await expect(
        createTcmbClient({ fetch }).getQuarterRates(2026, 10),
      ).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    },
  );

  it("accepts UTF-8 with a BOM and a single-quoted lowercase declaration", async () => {
    const fetch = upstream(
      (url) =>
        new Response(
          `\uFEFF${fixtureFor(url).replace('encoding="UTF-8"', "encoding='utf-8'")}`,
        ),
    );
    await expect(
      createTcmbClient({ fetch }).getQuarterRates(2026, 10),
    ).resolves.toMatchObject({ kind: "ForexBuying" });
  });

  it.each([
    [NaN, 10],
    [2026.5, 10],
    [1995, 10],
    [2005, 10],
    [2101, 10],
    [10000, 10],
    [2026, 2],
  ])(
    "rejects invalid direct adapter input (%s, %s) without making requests",
    async (year, month) => {
      const fetch = upstream();
      await expect(
        createTcmbClient({ fetch }).getQuarterRates(year, month as 10),
      ).rejects.toMatchObject({ code: "INVALID_PERIOD" });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("enforces a total deadline while missing-day responses consume time", async () => {
    vi.useFakeTimers();
    const fetch = upstream(
      (_, init) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => resolve(new Response(null, { status: 404 })),
            7_000,
          );
          init?.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(init.signal?.reason);
            },
            { once: true },
          );
        }),
    );
    const pending = createTcmbClient({ fetch }).getQuarterRates(2026, 10);
    const rejection = expect(pending).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
    await vi.advanceTimersByTimeAsync(24_000);
    await rejection;
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(12);
  });

  it("keeps successful months for 24 hours and returns independent result objects", async () => {
    let now = 0;
    const fetch = upstream();
    const client = createTcmbClient({ fetch, now: () => now });
    const first = await client.getQuarterRates(2026, 10);
    first.rates[0].value = "1";
    now = 86_399_999;
    const second = await client.getQuarterRates(2026, 10);
    expect(second.rates[0].value).toBe("48.1745");
    expect(fetch).toHaveBeenCalledTimes(3);
    now = 86_400_000;
    await client.getQuarterRates(2026, 10);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("deduplicates simultaneous callers and retries previously failed months", async () => {
    let fail = true;
    const fetch = upstream((url) =>
      fail
        ? new Response(null, { status: 503 })
        : new Response(fixtureFor(url)),
    );
    const client = createTcmbClient({ fetch });
    const results = await Promise.allSettled([
      client.getQuarterRates(2026, 10),
      client.getQuarterRates(2026, 10),
    ]);
    expect(results.every(({ status }) => status === "rejected")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
    fail = false;
    const [first, second] = await Promise.all([
      client.getQuarterRates(2026, 10),
      client.getQuarterRates(2026, 10),
    ]);
    expect(first).toEqual(second);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("rejects saturation without starting more than six distinct live month chains", async () => {
    const release: (() => void)[] = [];
    const fetch = upstream(
      (url) =>
        new Promise((resolve) => {
          release.push(() => resolve(new Response(fixtureFor(url))));
        }),
    );
    const client = createTcmbClient({ fetch });
    const first = client.getQuarterRates(2026, 10);
    const duplicate = client.getQuarterRates(2026, 10);
    const second = client.getQuarterRates(2026, 7);
    await expect(client.getQuarterRates(2026, 4)).rejects.toMatchObject({
      code: "BUSY",
    });
    expect(fetch).toHaveBeenCalledTimes(6);
    for (const resolve of release) resolve();
    await Promise.all([first, duplicate, second]);
    const final = client.getQuarterRates(2026, 4);
    for (const resolve of release.slice(6)) resolve();
    await expect(final).resolves.toMatchObject({ year: 2026, month: 4 });
  });

  it("evicts old historical entries instead of allowing the cache to grow indefinitely", async () => {
    const fetch = upstream();
    const client = createTcmbClient({ fetch });
    for (let year = 2018; year <= 2026; year += 1) {
      for (const month of [1, 4, 7, 10] as const)
        await client.getQuarterRates(year, month);
    }
    const previous = fetch.mock.calls.length;
    await client.getQuarterRates(2018, 1);
    expect(fetch.mock.calls.length).toBe(previous + 3);
  });

  it("exposes a typed safe error without retaining provider response text", () => {
    const error = new TcmbError("UPSTREAM_ERROR", 503);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("UPSTREAM_ERROR");
    expect(error.status).toBe(503);
  });
});

describe("TCMB scenario rates", () => {
  it("labels completed months and reuses the official historical cache", async () => {
    const fetch = upstream();
    const client = createTcmbClient({
      fetch,
      now: () => Date.parse("2026-09-08T09:00:00Z"),
    });
    const official = await client.getQuarterRates(2026, 7);
    const result = await client.getScenarioRates(2026, 7);
    expect(result).toEqual({
      year: 2026,
      month: 7,
      kind: "ForexBuying",
      asOf: "2026-09-08",
      rates: official.rates.map((rate) => ({
        year: rate.year,
        month: rate.month,
        status: "complete",
        rate,
      })),
    });
    result.rates[0].rate!.value = "1";
    expect((await client.getQuarterRates(2026, 7)).rates[0].value).toBe("48.1745");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("uses today's latest available publication for the ongoing reference month", async () => {
    const fetch = upstream((url) =>
      url.endsWith("08092026.xml")
        ? new Response(null, { status: 404 })
        : new Response(fixtureFor(url)),
    );
    const result = await createTcmbClient({
      fetch,
      now: () => Date.parse("2026-09-08T09:00:00Z"),
    }).getScenarioRates(2026, 10);
    expect(result.rates.map(({ status, rate }) => ({ status, date: rate?.date }))).toEqual([
      { status: "complete", date: "2026-07-31" },
      { status: "complete", date: "2026-08-31" },
      { status: "partial", date: "2026-09-07" },
    ]);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/202609/")))
      .toHaveLength(2);
  });

  it("does not request future reference months or invent missing rates", async () => {
    const fetch = upstream();
    const result = await createTcmbClient({
      fetch,
      now: () => Date.parse("2026-08-03T09:00:00Z"),
    }).getScenarioRates(2026, 10);
    expect(result.rates.map(({ year, month, status, rate }) => ({ year, month, status, date: rate?.date ?? null }))).toEqual([
      { year: 2026, month: 7, status: "complete", date: "2026-07-31" },
      { year: 2026, month: 8, status: "partial", date: "2026-08-03" },
      { year: 2026, month: 9, status: "unavailable", date: null },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/202609/"))).toBe(false);
  });

  it("returns all unavailable for an entirely future quarter without network access", async () => {
    const fetch = upstream();
    const result = await createTcmbClient({
      fetch,
      now: () => Date.parse("2026-09-08T09:00:00Z"),
    }).getScenarioRates(2100, 1);
    expect(result.rates).toEqual([
      { year: 2099, month: 10, status: "unavailable", rate: null },
      { year: 2099, month: 11, status: "unavailable", rate: null },
      { year: 2099, month: 12, status: "unavailable", rate: null },
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns unavailable when no current-month publication exists and does not borrow the prior month", async () => {
    const fetch = upstream((url) =>
      url.includes("/202609/")
        ? new Response(null, { status: 404 })
        : new Response(fixtureFor(url)),
    );
    const result = await createTcmbClient({
      fetch,
      now: () => Date.parse("2026-09-01T07:00:00Z"),
    }).getScenarioRates(2026, 10);
    expect(result.rates[2]).toEqual({ year: 2026, month: 9, status: "unavailable", rate: null });
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/202609/")))
      .toHaveLength(1);
  });

  it("preserves successful months and reports an outage without falling back to an older date", async () => {
    const fetch = upstream((url) =>
      url.includes("/202608/")
        ? new Response("private upstream details", { status: 503 })
        : new Response(fixtureFor(url)),
    );
    const result = await createTcmbClient({
      fetch,
      now: () => Date.parse("2026-09-08T09:00:00Z"),
    }).getScenarioRates(2026, 10);
    expect(result.rates.map(({ status }) => status)).toEqual(["complete", "error", "partial"]);
    expect(result.rates[1]).toEqual({
      year: 2026, month: 8, status: "error", rate: null, error: "UPSTREAM_ERROR",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain("private upstream details");
  });

  it("refreshes the ongoing month within sixty seconds while retaining historical months", async () => {
    let timestamp = Date.parse("2026-09-08T09:00:00Z");
    let published = false;
    const fetch = upstream((url) =>
      url.endsWith("08092026.xml") && !published
        ? new Response(null, { status: 404 })
        : new Response(fixtureFor(url)),
    );
    const client = createTcmbClient({ fetch, now: () => timestamp });
    expect((await client.getScenarioRates(2026, 10)).rates[2].rate?.date).toBe("2026-09-07");
    published = true;
    timestamp += 59_999;
    expect((await client.getScenarioRates(2026, 10)).rates[2].rate?.date).toBe("2026-09-07");
    timestamp += 1;
    expect((await client.getScenarioRates(2026, 10)).rates[2].rate?.date).toBe("2026-09-08");
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("uses an Istanbul date key to refresh immediately at local midnight", async () => {
    let timestamp = Date.parse("2026-09-08T20:59:59Z");
    const fetch = upstream();
    const client = createTcmbClient({ fetch, now: () => timestamp });
    expect((await client.getScenarioRates(2026, 10)).rates[2].rate?.date).toBe("2026-09-08");
    timestamp += 1_000;
    const next = await client.getScenarioRates(2026, 10);
    expect(next.asOf).toBe("2026-09-09");
    expect(next.rates[2].rate?.date).toBe("2026-09-09");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("takes one clock snapshot and marks December complete at the Istanbul year rollover", async () => {
    const fetch = upstream();
    const now = vi.fn(() => Date.parse("2026-12-31T21:00:00Z"));
    const result = await createTcmbClient({ fetch, now }).getScenarioRates(2027, 1);
    expect(now).toHaveBeenCalledTimes(1);
    expect(result.asOf).toBe("2027-01-01");
    expect(result.rates.map(({ year, month, status, rate }) => ({ year, month, status, date: rate?.date }))).toEqual([
      { year: 2026, month: 10, status: "complete", date: "2026-10-30" },
      { year: 2026, month: 11, status: "complete", date: "2026-11-30" },
      { year: 2026, month: 12, status: "complete", date: "2026-12-31" },
    ]);
  });

  it("does not reuse an ongoing-month result as the official final month-end rate", async () => {
    const fetch = upstream();
    const client = createTcmbClient({
      fetch,
      now: () => Date.parse("2026-09-08T09:00:00Z"),
    });
    expect((await client.getScenarioRates(2026, 10)).rates[2].rate?.date).toBe("2026-09-08");
    const official = await client.getQuarterRates(2026, 10);
    expect(official.rates[2].date).toBe("2026-09-30");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("keeps one as-of date when a request crosses midnight and refreshes the newly completed month", async () => {
    let timestamp = Date.parse("2026-09-30T20:59:59Z");
    const fetch = upstream((url) => {
      timestamp = Date.parse("2026-09-30T21:00:00Z");
      return new Response(fixtureFor(url));
    });
    const client = createTcmbClient({ fetch, now: () => timestamp });
    const beforeMidnight = await client.getScenarioRates(2026, 10);
    expect(beforeMidnight.asOf).toBe("2026-09-30");
    expect(beforeMidnight.rates[2].status).toBe("partial");
    const afterMidnight = await client.getScenarioRates(2026, 10);
    expect(afterMidnight.asOf).toBe("2026-10-01");
    expect(afterMidnight.rates[2].status).toBe("complete");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("shares the six-chain limit with official requests and deduplicates scenarios", async () => {
    const release: (() => void)[] = [];
    const fetch = upstream((url) => new Promise((resolve) => {
      release.push(() => resolve(new Response(fixtureFor(url))));
    }));
    const client = createTcmbClient({
      fetch,
      now: () => Date.parse("2026-09-08T09:00:00Z"),
    });
    const first = client.getScenarioRates(2026, 10);
    const duplicate = client.getScenarioRates(2026, 10);
    const official = client.getQuarterRates(2026, 7);
    await expect(client.getScenarioRates(2026, 4)).rejects.toMatchObject({ code: "BUSY" });
    expect(fetch).toHaveBeenCalledTimes(6);
    await expect(client.getScenarioRates(2100, 1)).resolves.toMatchObject({ year: 2100 });
    expect(fetch).toHaveBeenCalledTimes(6);
    for (const resolve of release) resolve();
    const [firstResult, duplicateResult] = await Promise.all([first, duplicate, official]);
    expect(firstResult).toEqual(duplicateResult);
  });

  it("returns successful months when the current-month request reaches its timeout", async () => {
    vi.useFakeTimers();
    const fetch = upstream((url) => url.includes("/202609/")
      ? new Promise<Response>(() => {})
      : new Response(fixtureFor(url)));
    const request = createTcmbClient({
      fetch,
      now: () => Date.parse("2026-09-08T09:00:00Z"),
    }).getScenarioRates(2026, 10);
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await request;
    expect(result.rates.map(({ status }) => status)).toEqual(["complete", "complete", "error"]);
    expect(result.rates[2]).toEqual({
      year: 2026, month: 9, status: "error", rate: null, error: "UPSTREAM_ERROR",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([[NaN, 10], [2005, 1], [2101, 10], [2026.5, 4], [2026, 2]])(
    "rejects invalid scenario input (%s, %s) before network access",
    async (year, month) => {
      const fetch = upstream();
      await expect(createTcmbClient({ fetch }).getScenarioRates(year, month as 10))
        .rejects.toMatchObject({ code: "INVALID_PERIOD" });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
