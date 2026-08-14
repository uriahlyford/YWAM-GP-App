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

async function openClass(page: Page, name: string) {
  await page.goto("/en/classes");
  await page.getByRole("link", { name: new RegExp(name) }).first().click();
  await page.waitForURL(/\/en\/classes\/[0-9a-f-]+$/);
}

test("the class list groups by academic year and shows the roster size", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.goto("/en/classes");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classes");
  // The seed has two years; only one carries classes, and it is marked current.
  await expect(page.getByText("2025–2026")).toBeVisible();
  await expect(page.getByText(/\d+ students/).first()).toBeVisible();
});

test("a class page lists its roster and its teachers", async ({ page }) => {
  await signIn(page, "admin");
  await openClass(page, "Kindergarten A");

  await expect(page.getByText("Students in this class")).toBeVisible();
  // "Teachers" is also a nav link, so match the card's own heading.
  await expect(page.getByRole("heading", { name: "Teachers" })).toBeVisible();
  // Scoped to the teachers list: "Homeroom teacher" is also an option inside the
  // collapsed assign-a-teacher form.
  await expect(
    page.locator("main li").filter({ hasText: "Homeroom teacher" }).first(),
  ).toBeVisible();

  // Every seeded class has students, so the roster must not be empty-stated.
  await expect(page.getByText("No students enrolled yet")).toHaveCount(0);
});

test("a teacher can open their own class but not another", async ({ page }) => {
  await signIn(page, "vanna.chan");

  await page.goto("/en/classes");
  const links = page.locator("main ul > li a");
  const count = await links.count();
  // Chan Vanna is homeroom of Kindergarten A and a subject teacher elsewhere,
  // so she sees a handful of classes rather than all ten.
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(10);

  // Find a class she is not attached to, via the administrator's full list.
  const hers = new Set<string>();
  for (let i = 0; i < count; i++) {
    hers.add((await links.nth(i).getAttribute("href")) ?? "");
  }

  await page.getByRole("button", { name: /Chan Vanna|Teacher/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "admin");
  await page.goto("/en/classes");
  const allLinks = page.locator("main ul > li a");
  const total = await allLinks.count();
  let foreign: string | null = null;
  for (let i = 0; i < total; i++) {
    const href = await allLinks.nth(i).getAttribute("href");
    if (href && !hers.has(href)) {
      foreign = href;
      break;
    }
  }
  expect(foreign).not.toBeNull();

  await page.getByRole("button", { name: /Sok Chanthou|Super/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "vanna.chan");
  await page.goto(foreign!);
  // Refused. The scoped query is what has to do this: an earlier version merged
  // the class id into the scope with an object spread, so the caller's id
  // silently replaced the scope's own id constraint and the query returned any
  // class in the school. Only the secondary check caught it.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /You don't have access|Not found/,
  );
});

test("a teacher cannot list another class's students by URL", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/en/classes");
  const adminHrefs = await page.locator("main ul > li a").evaluateAll((els) =>
    els.map((el) => el.getAttribute("href") ?? ""),
  );

  await page.getByRole("button", { name: /Sok Chanthou|Super/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/en\/login/);

  await signIn(page, "vanna.chan");
  await page.goto("/en/classes");
  const ownHrefs = await page.locator("main ul > li a").evaluateAll((els) =>
    els.map((el) => el.getAttribute("href") ?? ""),
  );

  const foreignId = adminHrefs
    .filter((href) => !ownHrefs.includes(href))
    .map((href) => href.split("/").pop())
    .find(Boolean);
  expect(foreignId).toBeTruthy();

  // The class filter on the student list sets `enrollments`, which is the same
  // key the teacher's own scope uses. Spreading rather than AND-ing would let
  // this URL list another class's children.
  await page.goto(`/en/students?class=${foreignId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Students");
  await expect(page.getByText("No students match")).toBeVisible();
});

test("an administrator can create a class and enroll a student into it", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.goto("/en/classes/new");

  const stamp = String(Date.now()).slice(-5);
  const name = `Test ${stamp}`;
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="nameKm"]').fill("ថ្នាក់សាកល្បង");

  await Promise.all([
    page.waitForURL(/\/en\/classes\/[0-9a-f-]+$/),
    page.getByRole("button", { name: /^Save$|Saving/ }).click(),
  ]);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.getByText("No students enrolled yet")).toBeVisible();

  // Enroll the first available student.
  await page.getByText("Enroll a student").click();
  const form = page.locator("details[open] form");
  await form.locator('select[name="studentId"]').selectOption({ index: 1 });
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    form.getByRole("button", { name: /Add|Saving/ }).click(),
  ]);

  await expect(page.getByText("1 student")).toBeVisible();
  await expect(page.getByText("No students enrolled yet")).toHaveCount(0);
});

test("a duplicate class name in the same year is refused", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/en/classes/new");

  // Years are listed newest first, so index 1 is 2025–2026 — the year that
  // already contains Kindergarten A. Explicit, rather than relying on whichever
  // year the form happens to default to.
  await page.locator('select[name="academicYearId"]').selectOption({ index: 1 });
  await page.locator('input[name="name"]').fill("Kindergarten A");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: /^Save$|Saving/ }).click(),
  ]);

  await expect(page.getByText("Another class in that year already has this name")).toBeVisible();
});

test("promoting a class moves its whole roster into the next year", async ({
  page,
}) => {
  await signIn(page, "admin");

  const stamp = String(Date.now()).slice(-6);

  // Self-contained: this test creates both ends and its own enrollments, so it
  // neither depends on nor drains the seeded classes.
  async function createClass(name: string, yearIndex: number) {
    await page.goto("/en/classes/new");
    await page
      .locator('select[name="academicYearId"]')
      .selectOption({ index: yearIndex });
    await page.locator('input[name="name"]').fill(name);
    await Promise.all([
      page.waitForURL(/\/en\/classes\/[0-9a-f-]+$/),
      page.getByRole("button", { name: /^Save$|Saving/ }).click(),
    ]);
    return page.url();
  }

  // Index 1 is 2025–2026, index 0 the later 2026–2027.
  const sourceUrl = await createClass(`From ${stamp}`, 1);

  const enrolled = 2;
  for (let i = 0; i < enrolled; i++) {
    await page.goto(sourceUrl);
    await page.getByText("Enroll a student").click();
    const form = page.locator("details[open] form");
    await form.locator('select[name="studentId"]').selectOption({ index: 1 });
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      form.getByRole("button", { name: /Add|Saving/ }).click(),
    ]);
  }

  await page.goto(sourceUrl);
  await expect(page.locator("main ul > li")).toHaveCount(enrolled);

  const target = `To ${stamp}`;
  const targetUrl = await createClass(target, 0);

  await page.goto(sourceUrl);
  await page
    .locator('select[name="toClassId"]')
    .selectOption({ label: `${target} · 2026–2027` });
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Move students to next year" }).click(),
  ]);

  await expect(page.getByText(`${enrolled} students moved`)).toBeVisible();

  // The source is emptied and the destination holds them.
  await expect(page.getByText("No students enrolled yet")).toBeVisible();

  await page.goto(targetUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(target);
  await expect(page.locator("main ul > li")).toHaveCount(enrolled);
});
