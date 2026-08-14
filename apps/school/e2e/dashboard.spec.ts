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

/**
 * How many registers the dashboard says are outstanding.
 *
 * Read rather than assumed: other suites in this run take registers and create
 * classes, so an absolute expectation here would depend on file ordering. The
 * assertions below are about relationships, which hold whatever ran first.
 */
async function outstanding(page: Page): Promise<number> {
  const text = await page.locator("main").innerText();
  if (/Every class is done/.test(text)) return 0;
  return Number(text.match(/(\d+)\s+class(?:es)? still to do/)?.[1] ?? -1);
}

async function studentCount(page: Page): Promise<number> {
  const tile = page
    .locator("main div")
    .filter({ hasText: /^\d+\s*Students$/ })
    .first();
  return Number((await tile.innerText()).match(/\d+/)?.[0] ?? -1);
}

test("the dashboard leads with what is outstanding and routes to the register", async ({
  page,
}) => {
  await signIn(page, "admin");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.getByText("Registers not taken")).toBeVisible();
  await expect(page.getByText("Absent today").first()).toBeVisible();

  expect(await outstanding(page)).toBeGreaterThanOrEqual(0);

  await page.getByRole("link", { name: "Take attendance" }).first().click();
  await expect(page).toHaveURL(/\/en\/attendance/);
});

test("the dashboard figures are scoped to the reader's own classes", async ({
  page,
}) => {
  await signIn(page, "admin");
  const adminOutstanding = await outstanding(page);
  const adminStudents = await studentCount(page);

  await page.getByRole("button", { name: /Sok Chanthou|Super/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "vanna.chan");
  const teacherStudents = await studentCount(page);

  // A teacher's headline figures cover their own classes, not the campus.
  expect(teacherStudents).toBeGreaterThan(0);
  expect(teacherStudents).toBeLessThan(adminStudents);
  expect(await outstanding(page)).toBeLessThanOrEqual(adminOutstanding);
});

test("taking a register moves that class off the outstanding list", async ({
  page,
}) => {
  await signIn(page, "admin");

  const before = await outstanding(page);
  test.skip(before === 0, "every register was already taken by an earlier suite");

  const firstClass = await page
    .getByRole("link", { name: "Take attendance" })
    .nth(1)
    .innerText();

  await page.getByRole("link", { name: "Take attendance" }).nth(1).click();
  await page.waitForURL(/\/attendance\/[0-9a-f-]+/);

  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: /Save attendance|Saving/ }).click(),
  ]);
  await expect(page.getByText("Attendance saved")).toBeVisible();

  await page.goto("/en/dashboard");
  expect(await outstanding(page)).toBe(before - 1);
  await expect(
    page.getByRole("link", { name: "Take attendance" }).filter({ hasText: firstClass }),
  ).toHaveCount(0);
});
