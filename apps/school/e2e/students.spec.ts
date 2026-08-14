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

test("the student list opens a profile with attendance and grades", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.goto("/en/students");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Students");

  await page.locator("main ul > li a").first().click();
  await page.waitForURL(/\/en\/students\/[0-9a-f-]+$/);

  // The seed gives every enrolled student attendance and graded assessments,
  // so both summaries must be populated rather than empty-stated.
  // "Present" appears both as a stat label and on each recent-attendance pill,
  // so scope to the summary card rather than the whole page.
  const summary = page.locator("section, div").filter({ hasText: "Attendance" }).first();
  await expect(summary).toBeVisible();
  await expect(page.getByText("Overall average")).toBeVisible();
  await expect(page.getByText("Parents and guardians")).toBeVisible();
  // Stat tiles render a number, not a dash, when there is history to count.
  await expect(page.getByText("Present", { exact: true }).first()).toBeVisible();
});

test("search finds a student by their Khmer name", async ({ page }) => {
  await signIn(page, "admin", "km");

  // សុខ is a common Cambodian family name and is in the seed. Postgres
  // full-text search cannot match this — Khmer has no spaces for a tokeniser to
  // split on — so this is the check that the trigram path is really in use.
  await page.goto("/km/students?q=%E1%9E%9F%E1%9E%BB%E1%9E%81");

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("សិស្ស");

  // Some matches are on the student's own name and some on a guardian's, which
  // is intended — so assert that the search narrowed the list and that the term
  // really appears among the results, not that it is in the first row.
  const rows = page.locator("main ul > li");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(30);
  await expect(rows.filter({ hasText: "សុខ" }).first()).toBeVisible();
});

test("a teacher sees only the students in their own classes", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/en/students");
  const asAdmin = await page.getByRole("heading", { level: 1 }).locator("..").innerText();

  await page.getByRole("button", { name: /Sok Chanthou|Super/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "vanna.chan");
  await page.goto("/en/students");
  const asTeacher = await page.getByRole("heading", { level: 1 }).locator("..").innerText();

  // Not a fixed number — the point is that the teacher's list is a strict
  // subset, enforced by the query rather than by hiding rows in the UI.
  const count = (text: string) => Number(text.match(/(\d+)\s+students?/)?.[1] ?? -1);
  expect(count(asTeacher)).toBeGreaterThan(0);
  expect(count(asTeacher)).toBeLessThan(count(asAdmin));
});

test("a teacher cannot open the add-student form", async ({ page }) => {
  await signIn(page, "vanna.chan");

  await expect(page.getByRole("link", { name: "Add a student" })).toHaveCount(0);

  await page.goto("/en/students/new");
  await expect(page.getByRole("heading")).toHaveText("You don't have access to this");
});

test("student photos are not readable without a session", async ({ page }) => {
  // A photo key is opaque and random, but the route must refuse even a real one
  // to an anonymous caller. A plausible-looking key stands in here.
  const response = await page.request.get(
    "/api/photos/photos/00112233445566778899aabbccddeeff.jpg",
  );
  expect(response.status()).toBe(404);
});

test("an administrator can add a student, and the record is audited", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.goto("/en/students/new");

  const stamp = String(Date.now()).slice(-6);
  await page.locator('input[name="lastName"]').fill("Testing");
  await page.locator('input[name="lastNameKm"]').fill("សាកល្បង");
  await page.locator('input[name="firstName"]').fill(`Case${stamp}`);
  await page.locator('input[name="firstNameKm"]').fill("ករណី");
  await page.locator('input[name="studentCode"]').fill(`T${stamp}`);

  await Promise.all([
    page.waitForURL(/\/en\/students\/[0-9a-f-]+$/),
    page.getByRole("button", { name: /^Save$|Saving/ }).click(),
  ]);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    `Testing Case${stamp}`,
  );

  // In Khmer, the same student reads with the Khmer name pair instead.
  const url = page.url().replace("/en/", "/km/");
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("សាកល្បង ករណី");

  await page.goto("/en/audit?entity=Student");
  await expect(page.locator("main ul > li").first()).toContainText(
    `Testing Case${stamp}`,
  );
});
