import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "sala-demo-2026";

async function signIn(page: Page, username: string) {
  await page.goto("/en/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/login"),
    ),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await page.waitForURL("**/dashboard");
}

/** The student codes in the report table's first column. */
async function codes(page: Page): Promise<string[]> {
  const cells = await page.locator("main tbody tr td:first-child").allInnerTexts();
  return cells.map((cell) => cell.trim());
}

/**
 * A month the seed has attendance for. The seed fills the term up to the day it
 * runs, so the previous month is complete whenever the suite runs.
 */
function lastMonth(): string {
  const now = new Date();
  const month = now.getUTCMonth(); // 0-based, so this is already "last month"
  const year = month === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const value = month === 0 ? 12 : month;
  return `${year}-${String(value).padStart(2, "0")}`;
}

test("a report runs on screen and downloads in all three formats", async ({
  page,
}) => {
  await signIn(page, "admin");

  await page.goto(`/en/reports?kind=monthly-attendance&month=${lastMonth()}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reports");
  await expect(page.getByRole("heading", { name: "Monthly attendance" })).toBeVisible();

  const rows = await codes(page);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0]).toMatch(/^S\d+$/);

  for (const [label, extension] of [
    ["CSV", "csv"],
    ["Excel", "xlsx"],
    ["PDF", "pdf"],
  ] as const) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: label, exact: true }).click(),
    ]);
    // Named for the school and the period the reader actually chose.
    expect(download.suggestedFilename()).toBe(
      `PP01-monthly-attendance-${lastMonth()}.${extension}`,
    );

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    expect(body.byteLength).toBeGreaterThan(500);

    if (extension === "csv") {
      // The UTF-8 BOM, without which Excel on Windows renders Khmer as mojibake.
      expect(body.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      expect(body.toString("utf8")).toContain(rows[0]);
    }
    if (extension === "xlsx") expect(body.subarray(0, 2).toString()).toBe("PK");
    if (extension === "pdf") expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  }
});

test("a report the reader has not finished choosing asks rather than guesses", async ({
  page,
}) => {
  await signIn(page, "admin");

  await page.goto("/en/reports?kind=student-report");
  await expect(page.getByText("Choose a student to run this report.")).toBeVisible();
  await expect(page.getByRole("link", { name: "PDF", exact: true })).toHaveCount(0);

  const select = page.locator('select[name="student"]');
  const value = await select.locator("option").nth(1).getAttribute("value");
  await select.selectOption(value!);

  await expect(page.getByRole("heading", { name: "Student report" })).toBeVisible();
  await expect(page.getByRole("link", { name: "PDF", exact: true })).toBeVisible();
});

test("a report only ever covers the classes the reader may see", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto(`/en/reports?kind=monthly-attendance&month=${lastMonth()}`);
  const everyone = await codes(page);

  await page.getByRole("button", { name: /Sok Chanthou|Super/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "vanna.chan");
  await page.goto(`/en/reports?kind=monthly-attendance&month=${lastMonth()}`);
  const mine = await codes(page);

  expect(mine.length).toBeGreaterThan(0);
  expect(mine.length).toBeLessThan(everyone.length);
  // Not merely a shorter list: every row is one this teacher is entitled to.
  expect(everyone).toEqual(expect.arrayContaining(mine));
});

test("the download route refuses a class the reader does not teach", async ({
  page,
  browser,
}) => {
  // Two readers at once, so the class picked is provably outside the teacher's
  // scope rather than assumed to be.
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await signIn(adminPage, "admin");
  await adminPage.goto("/en/reports?kind=class-attendance");
  const everyClass = await adminPage
    .locator('select[name="class"] option')
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
    );

  await signIn(page, "vanna.chan");
  await page.goto("/en/reports?kind=class-attendance");
  const herClasses = await page
    .locator('select[name="class"] option')
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
    );

  expect(herClasses.length).toBeGreaterThan(0);
  const notHers = everyClass.find((id) => !herClasses.includes(id));
  expect(notHers, "the school has a class this teacher does not teach").toBeTruthy();

  // Her own class exports; the query string cannot widen that.
  const hers = await page.request.get(
    `/api/reports/class-attendance?class=${herClasses[0]}&from=2026-01-01&to=2026-12-31&format=csv`,
  );
  expect(hers.status()).toBe(200);

  const refused = await page.request.get(
    `/api/reports/class-attendance?class=${notHers}&from=2026-01-01&to=2026-12-31&format=csv`,
  );
  expect(refused.status()).toBe(400);
  expect(await refused.text()).not.toContain(",");

  await admin.close();
});

test("the download route takes only the formats and reports it knows", async ({
  page,
}) => {
  await signIn(page, "admin");

  const badFormat = await page.request.get(
    `/api/reports/monthly-attendance?month=${lastMonth()}&format=exe`,
  );
  expect(badFormat.status()).toBe(400);

  const badKind = await page.request.get("/api/reports/salaries?format=csv");
  expect(badKind.status()).toBe(404);

  const good = await page.request.get(
    `/api/reports/monthly-attendance?month=${lastMonth()}&format=csv`,
  );
  expect(good.status()).toBe(200);
  expect(good.headers()["content-disposition"]).toContain("attachment");
  // A file full of children's names must never sit in a shared cache.
  expect(good.headers()["cache-control"]).toContain("no-store");
  expect(good.headers()["x-content-type-options"]).toBe("nosniff");
});

test("an export is written to the activity log", async ({ page }) => {
  await signIn(page, "admin");

  await page.goto(`/en/reports?kind=monthly-attendance&month=${lastMonth()}`);
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "CSV", exact: true }).click(),
  ]);

  await page.goto("/en/audit?action=EXPORT");
  const first = page.locator("main li").first();
  await expect(first).toContainText("Exported");
  await expect(first).toContainText("monthly-attendance");
  await expect(first).toContainText("csv");
});
