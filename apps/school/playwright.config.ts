import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks against a real browser and a real database.
 *
 * These are deliberately few and load-bearing: sign-in, the authorization
 * boundary, and taking a register. They exist to catch the failures that unit
 * tests structurally cannot — a server action that doesn't set its cookie, a
 * teacher who can reach another class, a Khmer layout that overflows a phone.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // Honour a Chromium already present in the environment (CI images often
    // ship one) rather than downloading a second copy per Playwright bump.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    {
      name: "phone",
      // The device most teachers will actually use.
      use: { ...devices["Pixel 7"], channel: undefined },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: undefined },
    },
  ],
});
