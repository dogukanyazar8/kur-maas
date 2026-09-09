import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { selectChoice } from "./select";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("confirmed example pays 51000 and clearly identifies scenario values", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Örneği dene" }).click();
  await expect(page.getByTestId("total")).toHaveText("51.000,00");
  await expect(page.getByTestId("base")).toContainText("45.000,00");
  await expect(page.getByTestId("adjustment")).toContainText("6.000,00");
  await expect(page.getByTestId("result")).toContainText("Senaryo");
  await expect(page.getByTestId("result")).toContainText("45,0000");
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-example.png`,
    fullPage: true,
  });
});

test("falling rates protect salary, and editing invalidates the previous result", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Örneği dene" }).click();
  await page.getByTestId("manual-0").fill("40");
  await expect(page.getByTestId("total")).toHaveCount(0);
  await page.getByTestId("manual-1").fill("41");
  await page.getByTestId("manual-2").fill("42");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("43.000,00");
  await expect(page.getByTestId("adjustment")).toContainText("0,00");
  await expect(page.getByTestId("result")).toContainText(
    "Mevcut kurunuz korundu",
  );
});

test("locale switching preserves value and language is independent from number format", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Örneği dene" }).click();
  await selectChoice(page, "Sayı biçimi", "US · 1,234.56");
  await expect(page.getByTestId("total")).toHaveText("51,000.00");
  await selectChoice(page, "Dil", "English");
  await expect(
    page.getByRole("heading", { name: "Know what your salary adds up to." }),
  ).toBeVisible();
  await expect(page.getByTestId("total")).toHaveText("51,000.00");
  await selectChoice(page, "Number format", "FR · 1 234,56");
  await expect(page.getByTestId("total")).toHaveText("51\u202f000,00");
});

test("ordinary month uses the last protected salary rate without fetching rates", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/rates")) requests.push(request.url());
  });
  await page.getByLabel("Aylık dolar maaşı").fill("1000");
  await page.getByLabel("Mevcut maaş kuru").fill("45");
  await selectChoice(page, "Ödeme ayı", "Ağustos");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("45.000,00");
  expect(requests).toEqual([]);
});

test("official data carries source dates and no salary is transmitted", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("**/api/rates?*", async (route) => {
    requests.push(route.request().url());
    expect(route.request().postData()).toBeNull();
    await route.fulfill({
      json: {
        year: 2026,
        month: 7,
        kind: "ForexBuying",
        rates: [
          {
            year: 2026,
            month: 4,
            date: "2026-04-30",
            value: "44",
            source: "https://www.tcmb.gov.tr/kurlar/202604/30042026.xml",
          },
          {
            year: 2026,
            month: 5,
            date: "2026-05-25",
            value: "45",
            source: "https://www.tcmb.gov.tr/kurlar/202605/25052026.xml",
          },
          {
            year: 2026,
            month: 6,
            date: "2026-06-30",
            value: "46",
            source: "https://www.tcmb.gov.tr/kurlar/202606/30062026.xml",
          },
        ],
      },
    });
  });
  await page.getByLabel("Aylık dolar maaşı").fill("1000");
  await page.getByLabel("Mevcut maaş kuru").fill("43");
  await selectChoice(page, "Ödeme ayı", "Temmuz");
  await page.getByLabel("Ödeme yılı").fill("2026");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("51.000,00");
  await expect(page.getByRole("link", { name: /25 May 2026/ })).toHaveAttribute(
    "href",
    "https://www.tcmb.gov.tr/kurlar/202605/25052026.xml",
  );
  expect(requests).toHaveLength(1);
  expect(new URL(requests[0]).search).toBe("?year=2026&month=7");
});

test("network failure never produces a salary from invented rates", async ({
  page,
}) => {
  await page.route("**/api/rates?*", (route) =>
    route.fulfill({ status: 502, json: { error: "UPSTREAM_ERROR" } }),
  );
  await page.getByLabel("Aylık dolar maaşı").fill("1000");
  await page.getByLabel("Mevcut maaş kuru").fill("43");
  await selectChoice(page, "Ödeme ayı", "Temmuz");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(
    page.getByRole("region", { name: "Hesap bilgilerin" }).getByRole("alert"),
  ).toContainText("TCMB");
  await expect(page.getByTestId("total")).toHaveCount(0);
});

test("form and result are accessible and fit the viewport", async ({
  page,
}, testInfo) => {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-empty.png`,
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Örneği dene" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("carrying a recurring average preserves cents and scenario provenance", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Örneği dene" }).click();
  await page.getByTestId("manual-0").fill("43");
  await page.getByTestId("manual-1").fill("43");
  await page.getByTestId("manual-2").fill("43,0001");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("43.000,13");
  await page.getByRole("button", { name: "Sonraki ayı hesapla" }).click();
  await expect(page.getByLabel("Mevcut maaş kuru")).toHaveValue("43,0000");
  await expect(page.getByTestId("total")).toHaveText("43.000,03");
  await expect(
    page.getByRole("combobox", { name: "Ödeme ayı", exact: true }),
  ).toContainText("Ağustos");
  await expect(page.getByTestId("result")).toContainText("Senaryo");

  // The shortened input must not replace the precise rate during recalculation.
  await page.getByLabel("Aylık dolar maaşı").fill("2000");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("86.000,07");
  await selectChoice(page, "Sayı biçimi", "US · 1,234.56");
  await expect(page.getByLabel("Mevcut maaş kuru")).toHaveValue("43.0000");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("86,000.07");

  // An explicit edit replaces the carried rate, including its hidden precision.
  await page.getByLabel("Mevcut maaş kuru").fill("44");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("88,000.00");
});

test("inputs cannot submit or lose values before hydration", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3100");
  await expect(page.getByLabel("Aylık dolar maaşı")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Maaşımı hesapla" }),
  ).toBeDisabled();
  await expect(
    page.locator('input[name="salary"], input[name="currentRate"]'),
  ).toHaveCount(0);
  await context.close();
});
