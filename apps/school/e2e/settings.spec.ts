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

/** Opens a disclosure row and submits its form, waiting for the action. */
async function saveRow(page: Page, rowLabel: string, fill: (form: ReturnType<Page["locator"]>) => Promise<void>) {
  await page.getByText(rowLabel, { exact: true }).click();
  const form = page.locator("details[open] form");
  await fill(form);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    form.getByRole("button", { name: /Save|Saving/ }).click(),
  ]);
}

test("an administrator can rename a subject in Khmer, and the change is audited", async ({
  page,
}) => {
  await signIn(page, "admin");

  await page.goto("/en/settings/subjects");
  const khmerName = `វិទ្យាសាស្ត្រ ${Date.now() % 100000}`;

  await saveRow(page, "Science", async (form) => {
    await form.locator('input[name="nameKm"]').fill(khmerName);
  });

  await expect(page.getByText(khmerName)).toBeVisible();

  // The audit entry must name the field that moved and both of its values.
  await page.goto("/en/audit?entity=Subject");
  const latest = page.locator("main ul > li").first();
  await expect(latest).toContainText("Updated");
  await expect(latest).toContainText("Science");
  await expect(latest).toContainText("nameKm");
  await expect(latest).toContainText(khmerName);

  // Bookkeeping columns are noise and must stay out of the diff.
  await expect(latest).not.toContainText("updatedAt");
});

test("a duplicate subject code is refused", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/en/settings/subjects");

  await saveRow(page, "Science", async (form) => {
    await form.locator('input[name="code"]').fill("KHM");
  });

  await expect(page.locator("details[open] form [role=alert]")).toHaveText(
    "That code is already used by another subject",
  );
});

test("the grade-level list counts its classes with the right plural", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.goto("/en/settings/grade-levels");

  // The seed gives Kindergarten one class and Grade 1 two. English needs both
  // forms; Khmer, which has no grammatical plural, needs neither — the point is
  // that neither language gets "1 classes".
  const rows = page.locator("main details");
  await expect(rows.filter({ hasText: "Kindergarten" })).toContainText("1 class");
  await expect(rows.filter({ hasText: "Grade 1" })).toContainText("2 classes");
});

test("a teacher cannot reach settings", async ({ page }) => {
  await signIn(page, "vanna.chan");
  await page.goto("/en/settings/subjects");
  await expect(page.getByRole("heading")).toHaveText("You don't have access to this");
});
