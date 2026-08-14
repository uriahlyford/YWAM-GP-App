import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "sala-demo-2026";

async function signIn(page: Page, username: string, locale = "en") {
  await page.goto(`/${locale}/login`);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/login"),
    ),
    page.getByRole("button", { name: locale === "km" ? "ចូលប្រើ" : "Sign in" }).click(),
  ]);
  await page.waitForURL("**/dashboard");
}

const sheet = (page: Page) =>
  page.getByRole("list", { name: "Enter marks" }).locator("> li");

test("the gradebook opens on the term containing today, with marks in it", async ({
  page,
}) => {
  await signIn(page, "vanna.chan");
  await page.goto("/en/grades");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grades");

  // The seed's assessments are all in Semester 2, which is the term today falls
  // in. Defaulting to the year's first term would land the teacher on an empty
  // sheet — so this asserts real percentages are on screen, not dashes.
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.getByText(/^\d+%$/).first()).toBeVisible();
  await expect(page.getByText("Class average")).toBeVisible();
});

test("choosing a subject reveals its assessments and marking progress", async ({
  page,
}) => {
  await signIn(page, "vanna.chan");
  await page.goto("/en/grades");

  await page.locator('select[name="subject"]').selectOption({ index: 1 });

  await expect(page.getByRole("heading", { name: "Assessments" })).toBeVisible();
  await expect(page.getByText(/\d+ of \d+ marked/).first()).toBeVisible();
});

test("marks can be entered, and only changed marks are audited", async ({
  page,
}) => {
  await signIn(page, "vanna.chan");
  await page.goto("/en/grades");
  await page.locator('select[name="subject"]').selectOption({ index: 1 });

  await page.getByRole("link", { name: /of \d+ marked/ }).first().click();
  await page.waitForURL(/\/grades\/assessment\/[0-9a-f-]+/);

  const rows = sheet(page);
  expect(await rows.count()).toBeGreaterThan(0);

  // Save unchanged first, so the edit below is the only change in the log.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: /Save marks|Saving/ }).click(),
  ]);
  await expect(page.getByText("Marks saved")).toBeVisible();

  const firstRow = rows.first();
  const childName = (await firstRow.locator("span.font-medium").first().innerText()).trim();
  const field = firstRow.locator('input[type="number"]');
  const max = Number(await field.getAttribute("max"));
  const newMark = String(Math.max(0, max - 1));
  await field.fill(newMark);

  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: /Save marks|Saving/ }).click(),
  ]);
  await expect(page.getByText("1 mark changed")).toBeVisible();

  // It survives a reload…
  await page.reload();
  await expect(sheet(page).first().locator('input[type="number"]')).toHaveValue(
    newMark,
  );

  // …and the change is attributable. A teacher cannot read the log, so this is
  // checked as an administrator.
  await page.getByRole("button", { name: /Chan Vanna|Teacher/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "admin");
  await page.goto("/en/audit?entity=GradeRecord");
  const latest = page.locator("main ul > li").first();
  await expect(latest).toContainText(childName.split(" ")[0]);
  await expect(latest).toContainText("Chan Vanna");
});

test("an empty field means not marked, which is not a zero", async ({ page }) => {
  await signIn(page, "vanna.chan");
  await page.goto("/en/grades");
  await page.locator('select[name="subject"]').selectOption({ index: 1 });
  await page.getByRole("link", { name: /of \d+ marked/ }).first().click();
  await page.waitForURL(/\/grades\/assessment\/[0-9a-f-]+/);

  const firstRow = sheet(page).first();
  await firstRow.locator('input[type="number"]').fill("");

  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: /Save marks|Saving/ }).click(),
  ]);
  await expect(page.getByText("Marks saved")).toBeVisible();

  await page.reload();
  const row = sheet(page).first();
  await expect(row.locator('input[type="number"]')).toHaveValue("");
  // Labelled as unmarked rather than shown as a zero.
  await expect(row).toContainText("Not marked");
});

test("a mark above the maximum is refused", async ({ page }) => {
  await signIn(page, "vanna.chan");
  await page.goto("/en/grades");
  await page.locator('select[name="subject"]').selectOption({ index: 1 });
  await page.getByRole("link", { name: /of \d+ marked/ }).first().click();
  await page.waitForURL(/\/grades\/assessment\/[0-9a-f-]+/);

  const field = sheet(page).first().locator('input[type="number"]');
  const max = Number(await field.getAttribute("max"));
  await field.fill(String(max + 50));

  // The save button disables rather than letting an impossible mark be sent.
  await expect(page.getByRole("button", { name: "Save marks" })).toBeDisabled();
  await expect(
    page.getByText("Higher than the maximum for this assessment").first(),
  ).toBeVisible();
});

test("a teacher cannot open an assessment for another class", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/en/grades");

  // Grade 1 A belongs to Ly Piseth in the seed, not to Chan Vanna.
  await page
    .locator('select[name="class"]')
    .selectOption({ label: "Grade 1 A · 2025–2026" });
  await page.locator('select[name="subject"]').selectOption({ index: 1 });

  // Assert the class really is the foreign one before trusting the link. An
  // earlier version of the pickers built each navigation from a stale URL, so
  // the second change reverted the first and this test silently opened the
  // teacher's own class.
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator("main")).toContainText("Grade 1 A");

  const foreign = await page
    .getByRole("link", { name: /of \d+ marked/ })
    .first()
    .getAttribute("href");
  expect(foreign).toBeTruthy();

  await page.getByRole("button", { name: /Sok Chanthou|Super/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "vanna.chan");
  await page.goto(foreign!);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /You don't have access|Not found/,
  );
});

test("the gradebook reads in Khmer", async ({ page }) => {
  await signIn(page, "vanna.chan", "km");
  await page.goto("/km/grades");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ពិន្ទុ");
  await expect(page.getByText("មធ្យមភាគថ្នាក់")).toBeVisible();
  // Subject names come from the school's own Khmer spellings.
  await expect(page.getByRole("table").getByText("ភាសាខ្មែរ")).toBeVisible();
});
