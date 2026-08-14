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

test("a teacher is not offered the activity log or settings", async ({ page }) => {
  await signIn(page, "vanna.chan");

  const nav = page.locator("nav").first();
  await expect(nav).toContainText("Attendance");
  await expect(nav).not.toContainText("Activity log");
  await expect(nav).not.toContainText("Settings");
});

test("a teacher typing the activity log URL is refused", async ({ page }) => {
  await signIn(page, "vanna.chan");

  // Hiding the link is convenience; this is the check that matters.
  await page.goto("/en/audit");
  await expect(page.getByRole("heading")).toHaveText("You don't have access to this");
});

test("a school administrator can read the activity log", async ({ page }) => {
  await signIn(page, "office");

  await expect(page.locator("nav").first()).toContainText("Activity log");

  await page.goto("/en/audit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Activity log");

  // The sign-in this test just performed must itself be in the log, attributed
  // to the person who did it. Scoped to the list, because the filter dropdown
  // also contains the words "Signed in".
  const entries = page.locator("main ul > li");
  await expect(entries.first()).toContainText("Meas Sreyneang");
  await expect(entries.first()).toContainText("Signed in");
});
