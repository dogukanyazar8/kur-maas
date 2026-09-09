import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { selectChoice } from "./select";

const scenario = {
  year: 2026,
  month: 10,
  kind: "ForexBuying",
  asOf: "2026-09-08",
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
    {
      year: 2026,
      month: 8,
      status: "complete",
      rate: {
        year: 2026,
        month: 8,
        date: "2026-08-31",
        value: "48.1745",
        source: "https://www.tcmb.gov.tr/kurlar/202608/31082026.xml",
      },
    },
    {
      year: 2026,
      month: 9,
      status: "partial",
      rate: {
        year: 2026,
        month: 9,
        date: "2026-09-08",
        value: "48.5",
        source: "https://www.tcmb.gov.tr/kurlar/202609/08092026.xml",
      },
    },
  ],
};

test("scenario prefills published rates with dates and marks the unfinished month", async ({
  page,
}, testInfo) => {
  const urls: string[] = [];
  await page.route("**/api/scenario-rates?*", (route) => {
    urls.push(route.request().url());
    return route.fulfill({ json: scenario });
  });
  await page.goto("/");
  await selectChoice(page, "Ödeme ayı", "Ekim");
  await page.getByRole("button", { name: "Senaryo", exact: true }).click();
  await expect(page.getByTestId("manual-0")).toHaveValue("47,3452");
  await expect(page.getByTestId("manual-1")).toHaveValue("48,1745");
  await expect(page.getByTestId("manual-2")).toHaveValue("48,5000");
  await expect(page.getByTestId("scenario-reference-2")).toContainText(
    "Geçici",
  );
  await expect(page.getByTestId("scenario-reference-2")).toContainText(
    "8 Eyl 2026",
  );
  await expect(page.getByRole("link", { name: /8 Eyl 2026/ })).toHaveAttribute(
    "href",
    scenario.rates[2].rate.source,
  );
  expect(new URL(urls[0]).search).toBe("?year=2026&month=10");
  await page.getByLabel("Aylık dolar maaşı").fill("1000");
  await page.getByLabel("Mevcut maaş kuru").fill("43");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("63.026,27");
  await expect(page.getByTestId("result")).toContainText("Senaryo");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-scenario.png`,
    fullPage: true,
  });
});

test("a late response never overwrites a user's scenario edit or reinterprets its locale", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/scenario-rates?*", async (route) => {
    await pending;
    await route.fulfill({ json: scenario });
  });
  await page.goto("/");
  await selectChoice(page, "Ödeme ayı", "Ekim");
  const started = page.waitForRequest("**/api/scenario-rates?*");
  await page.getByRole("button", { name: "Senaryo", exact: true }).click();
  await started;
  await page.getByTestId("manual-0").fill("55,1234");
  await selectChoice(page, "Sayı biçimi", "US · 1,234.56");
  release();
  await expect(page.getByTestId("manual-1")).toHaveValue("48.1745");
  await expect(page.getByTestId("manual-0")).toHaveValue("55.1234");
  await expect(page.getByTestId("scenario-reference-0")).toContainText(
    "Düzenlendi",
  );
});

test("period changes clear old scenario values; future months stay empty", async ({
  page,
}) => {
  await page.route("**/api/scenario-rates?*", (route) => {
    const month = new URL(route.request().url()).searchParams.get("month");
    return route.fulfill({
      json:
        month === "10"
          ? scenario
          : {
              ...scenario,
              year: 2027,
              month: 1,
              rates: [10, 11, 12].map((month) => ({
                year: 2026,
                month,
                status: "unavailable",
                rate: null,
              })),
            },
    });
  });
  await page.goto("/");
  await selectChoice(page, "Ödeme ayı", "Ekim");
  await page.getByRole("button", { name: "Senaryo", exact: true }).click();
  await expect(page.getByTestId("manual-0")).toHaveValue("47,3452");
  await page.getByLabel("Ödeme yılı").fill("2027");
  await selectChoice(page, "Ödeme ayı", "Ocak");
  await expect(page.getByTestId("manual-0")).toHaveValue("");
  await expect(page.getByTestId("scenario-reference-0")).toContainText(
    "Henüz veri yok",
  );
});

test("failed scenario fetch leaves manual entry usable and labels the failure", async ({
  page,
}) => {
  await page.route("**/api/scenario-rates?*", (route) =>
    route.fulfill({ status: 502, json: { error: "UPSTREAM_ERROR" } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Senaryo", exact: true }).click();
  await expect(page.getByTestId("scenario-status")).toContainText("alınamadı");
  await page.getByTestId("manual-0").fill("44");
  await page.getByTestId("manual-1").fill("45");
  await page.getByTestId("manual-2").fill("46");
  await page.getByLabel("Aylık dolar maaşı").fill("1000");
  await page.getByLabel("Mevcut maaş kuru").fill("43");
  await page.getByRole("button", { name: "Maaşımı hesapla" }).click();
  await expect(page.getByTestId("total")).toHaveText("51.000,00");
});

test("custom choices support keyboard navigation, dismissal, and accessible popup styling", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const month = page.getByRole("combobox", { name: "Ödeme ayı", exact: true });
  await expect(month).toBeEnabled();
  await month.focus();
  await month.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Temmuz", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("option", { name: "Temmuz", exact: true })
    .press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "Ağustos", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(month).toContainText("Ağustos");
  await month.press("Enter");
  await page.keyboard.press("Escape");
  await expect(month).toBeFocused();
  const language = page.getByRole("combobox", { name: "Dil", exact: true });
  await language.click();
  await expect(
    page.getByRole("option", { name: "Türkçe", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("option", { name: "Türkçe", exact: true }),
  ).toBeFocused();
  // Radix traps focus and hides the background while its popup is open.
  // Audit that active surface here; the full page is audited with the popup closed.
  expect(
    (await new AxeBuilder({ page }).include('[role="listbox"]').analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-combobox.png`,
    animations: "disabled",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(language).toBeFocused();
  await month.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-months.png`,
    animations: "disabled",
    fullPage: false,
  });
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(month).toBeFocused();
  await page.getByLabel("Aylık dolar maaşı").hover();
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-hover.png`,
    animations: "disabled",
    fullPage: true,
  });
  await page.getByLabel("Aylık dolar maaşı").focus();
  await expect(page.getByLabel("Aylık dolar maaşı")).toBeFocused();
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-focus.png`,
    animations: "disabled",
    fullPage: true,
  });
});

test("textbox focus rings remain visible while hovered without double borders", async ({ page }) => {
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const salary = page.getByLabel("Aylık dolar maaşı");
  await expect(salary).toBeEnabled();
  const wrapper = salary.locator("..");
  await salary.focus();
  await page.mouse.move(0, 0);
  const ring = await wrapper.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(ring).not.toBe("none");
  await salary.hover();
  await expect(wrapper).toHaveCSS("box-shadow", ring);
  await expect(salary).toHaveCSS("box-shadow", "none");
  const year = page.getByLabel("Ödeme yılı");
  await year.focus();
  await page.mouse.move(0, 0);
  const yearRing = await year.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(yearRing).not.toBe("none");
  await year.hover();
  await expect(year).toHaveCSS("box-shadow", yearRing);
});

test("a response for an abandoned period cannot fill the new period", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/scenario-rates?*", async (route) => {
    const month = new URL(route.request().url()).searchParams.get("month");
    if (month === "10") {
      await pending;
      await route.fulfill({ json: scenario });
    } else {
      await route.fulfill({
        json: {
          ...scenario,
          month: 1,
          rates: [10, 11, 12].map((month) => ({
            year: 2025,
            month,
            status: "unavailable",
            rate: null,
          })),
        },
      });
    }
  });
  await page.goto("/");
  await selectChoice(page, "Ödeme ayı", "Ekim");
  const started = page.waitForRequest("**/api/scenario-rates?*");
  await page.getByRole("button", { name: "Senaryo", exact: true }).click();
  await started;
  await selectChoice(page, "Ödeme ayı", "Ocak");
  await expect(page.getByTestId("scenario-reference-0")).toContainText(
    "Henüz veri yok",
  );
  release();
  await page.getByTestId("manual-0").fill("55");
  await expect(page.getByTestId("manual-0")).toHaveValue("55");
  await expect(page.getByTestId("manual-1")).toHaveValue("");
  await expect(page.getByRole("link", { name: /31 Tem 2026/ })).toHaveCount(0);
});
