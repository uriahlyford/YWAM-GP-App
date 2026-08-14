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

/** Opens the register for the first class the signed-in user can take. */
async function openFirstRegister(page: Page, locale = "en") {
  await page.goto(`/${locale}/attendance`);
  await page.locator("main ul > li a").first().click();
  await page.waitForURL(/\/attendance\/[0-9a-f-]+/);
}

/** The register list specifically — the change-history card is also a list. */
const roster = (page: Page, label = "Students in this class") =>
  page.getByRole("list", { name: label }).locator("> li");

const save = (page: Page, label = "Save attendance") =>
  Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: new RegExp(`${label}|Saving`) }).click(),
  ]);

test("a teacher sees only their own classes to take", async ({ page }) => {
  await signIn(page, "vanna.chan");
  await page.goto("/en/attendance");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Attendance");

  const classRows = page.locator("main ul > li");
  const count = await classRows.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(10);
  await expect(page.getByText(/still to do|Every class is done/)).toBeVisible();
});

test("everyone starts present, so a full class is one tap to record", async ({
  page,
}) => {
  await signIn(page, "vanna.chan");
  await openFirstRegister(page);

  // The default is what makes this screen fast: no student begins unmarked.
  const rows = roster(page);
  const total = await rows.count();
  expect(total).toBeGreaterThan(0);
  await expect(page.getByText("Present", { exact: true })).toHaveCount(total);
  await expect(page.getByText(new RegExp(`${total} present`))).toBeVisible();

  await save(page);
  await expect(page.getByText("Attendance saved")).toBeVisible();

  // And the class now reads as taken on the index.
  await page.goto("/en/attendance");
  await expect(page.locator("main ul > li").first()).toContainText("Taken");
});

test("marking one child absent records only that change, and it is audited", async ({
  page,
}) => {
  await signIn(page, "vanna.chan");
  await openFirstRegister(page);

  // Baseline: save everyone present first, so the change below is the only one.
  await save(page);
  await expect(page.getByText("Attendance saved")).toBeVisible();

  const firstRow = roster(page).first();
  const childName = (await firstRow.locator("span.font-medium").first().innerText()).trim();

  await firstRow.getByRole("button").first().click();
  await firstRow.getByRole("radio", { name: "Absent" }).click();

  await save(page);
  // Exactly one record changed — a register confirmed unchanged must not write
  // thirty log lines, and this is the assertion that holds that line.
  await expect(page.getByText("1 change")).toBeVisible();

  // The trail appears on the register itself, where the change was made.
  await expect(page.getByText("Earlier changes")).toBeVisible();

  // And in the activity log, which a teacher deliberately cannot read — so the
  // rest of this is checked as an administrator.
  await page.getByRole("button", { name: /Chan Vanna|Teacher/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "admin");
  await page.goto("/en/audit?entity=AttendanceRecord");
  const latest = page.locator("main ul > li").first();
  await expect(latest).toContainText(childName.split(" ")[0]);
  await expect(latest).toContainText("PRESENT");
  await expect(latest).toContainText("ABSENT");
  await expect(latest).toContainText("Chan Vanna");
});

test("saving an unchanged register writes nothing", async ({ page }) => {
  await signIn(page, "vanna.chan");
  await openFirstRegister(page);

  await save(page);
  await expect(page.getByText("Attendance saved")).toBeVisible();

  // Second save with no edits in between.
  await save(page);
  await expect(page.getByText("Attendance saved")).toBeVisible();
  await expect(page.getByText(/\d+ changes?/)).toHaveCount(0);
});

test("a late arrival can carry its minutes", async ({ page }) => {
  await signIn(page, "vanna.chan");
  await openFirstRegister(page);

  const row = roster(page).first();
  await row.getByRole("button").first().click();
  await row.getByRole("radio", { name: "Late" }).click();

  // The row stays open for Late specifically, because it needs a follow-up.
  const minutes = row.locator('input[type="number"]');
  await expect(minutes).toBeVisible();
  await minutes.fill("15");

  await save(page);
  await expect(page.getByText("Attendance saved")).toBeVisible();

  await page.reload();
  await expect(roster(page).first()).toContainText("Late");
  await expect(roster(page).first()).toContainText("15");
});

test("the register is dated in the school's timezone, not the browser's", async ({
  browser,
}) => {
  // A phone set to Los Angeles is, at some hours, on the previous calendar day
  // from Phnom Penh. The register must still be filed against the school's day.
  const context = await browser.newContext({ timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();

  await signIn(page, "vanna.chan");
  await page.goto("/en/attendance");

  const heading = page.locator("main p").first();
  const shown = await heading.innerText();

  // The date field is populated from the server's notion of the school's today.
  const field = page.locator('input[type="date"]');
  const value = await field.inputValue();
  expect(shown).toContain(value.slice(-2).replace(/^0/, ""));

  await context.close();
});

test("a teacher cannot take another class's register by URL", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/en/attendance");
  const adminHrefs = await page.locator("main ul > li a").evaluateAll((els) =>
    els.map((el) => el.getAttribute("href") ?? ""),
  );

  await page.getByRole("button", { name: /Sok Chanthou|Super/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "vanna.chan");
  await page.goto("/en/attendance");
  const ownHrefs = await page.locator("main ul > li a").evaluateAll((els) =>
    els.map((el) => el.getAttribute("href") ?? ""),
  );

  const foreign = adminHrefs.find((href) => !ownHrefs.includes(href));
  expect(foreign).toBeTruthy();

  await page.goto(foreign!);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /You don't have access|Not found/,
  );
});

test("the register reads in Khmer", async ({ page }) => {
  await signIn(page, "vanna.chan", "km");
  await openFirstRegister(page, "km");

  await expect(page.getByRole("button", { name: "រក្សាទុកវត្តមាន" })).toBeVisible();
  await expect(page.getByText("សម្គាល់ទាំងអស់ថាមានវត្តមាន")).toBeVisible();

  // Open a row and check the whole status vocabulary, rather than whichever
  // status a previous test happened to leave on the first child.
  const row = roster(page, "សិស្សក្នុងថ្នាក់នេះ").first();
  await row.getByRole("button").first().click();
  for (const label of [
    "មានវត្តមាន",
    "អវត្តមាន",
    "មកយឺត",
    "សុំច្បាប់",
    "ចេញមុនម៉ោង",
  ]) {
    await expect(row.getByRole("radio", { name: label })).toBeVisible();
  }
});
