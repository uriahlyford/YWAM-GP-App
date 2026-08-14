import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "sala-demo-2026";

/**
 * Fields are addressed by id rather than by label text: the visible label
 * carries a required asterisk, so an exact text match would be brittle. The
 * label association itself is asserted separately, below.
 *
 * `navigate: false` fills the form on the page already open, which is how the
 * `?next=` redirect gets exercised — going to a bare /login would drop it.
 */
async function submit(page: Page, username: string, password: string, locale = "en") {
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  const button = page.getByRole("button", {
    name: locale === "km" ? "ចូលប្រើ" : "Sign in",
  });

  // Wait for the server action to answer before returning. The button disables
  // itself while an attempt is in flight, so a test that clicks again too
  // quickly silently does nothing at all.
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/login"),
    ),
    button.click(),
  ]);
}

async function signIn(
  page: Page,
  username: string,
  { locale = "en", navigate = true } = {},
) {
  if (navigate) await page.goto(`/${locale}/login`);
  await submit(page, username, PASSWORD, locale);
}

/** Next.js renders its own `role="alert"` route announcer, so scope to the form. */
function formError(page: Page) {
  return page.locator('form [role="alert"]');
}

test("an unauthenticated visitor is sent to sign in and back again", async ({
  page,
}) => {
  await page.goto("/en/account/password");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Faccount%2Fpassword/);

  await signIn(page, "admin", { navigate: false });

  // The `next` parameter should return them to where they were headed, rather
  // than dumping them on the dashboard to navigate again.
  await expect(page).toHaveURL(/\/en\/account\/password/);
});

test("both sign-in fields are properly labelled", async ({ page }) => {
  await page.goto("/en/login");
  // The accessible name must be the label alone — the required marker is
  // decoration and belongs out of the accessibility tree.
  await expect(page.locator("#username")).toHaveAccessibleName("Username");
  await expect(page.locator("#password")).toHaveAccessibleName("Password");
});

test("a wrong password is rejected without revealing whether the user exists", async ({
  page,
}) => {
  await page.goto("/en/login");
  await submit(page, "admin", "not-the-password");
  await expect(formError(page)).toHaveText("Wrong username or password.");

  // Word for word the same for a username that doesn't exist at all — the
  // message must not tell an attacker which of a school's usernames are real.
  await submit(page, "nobody-here-at-all", "not-the-password");
  await expect(formError(page)).toHaveText("Wrong username or password.");

  // The real password still works afterwards, so the failed attempts above
  // haven't locked out a teacher who simply mistyped.
  await signIn(page, "admin", { navigate: false });
  await expect(page).toHaveURL(/\/en\/dashboard/);
});

test("the interface switches to Khmer and stays there", async ({ page }) => {
  await signIn(page, "admin");
  await expect(page).toHaveURL(/\/en\/dashboard/);

  await page.getByRole("button", { name: "ខ្មែរ" }).click();

  await expect(page).toHaveURL(/\/km\/dashboard/);
  await expect(page.locator("html")).toHaveAttribute("lang", "km");

  // The choice survives a fresh visit to the root.
  await page.goto("/");
  await expect(page).toHaveURL(/\/km\//);
});

test("signing out ends the session", async ({ page }) => {
  await signIn(page, "admin");
  await expect(page).toHaveURL(/\/en\/dashboard/);

  await page.getByRole("button", { name: /Sok Chanthou|Super/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/en\/login/);

  // The cookie is gone, so a protected page bounces again.
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/login/);
});
