const { test, expect } = require("@playwright/test");

test("main page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  // Sidebar should be visible on desktop
  await expect(page.locator("#sidebar")).toBeVisible();
});

test("can open wizard and create a session", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#new-session-btn")).toBeVisible({ timeout: 3000 });
  await page.click("#new-session-btn");
  await expect(page.locator("#wizard-modal")).toBeVisible();
  await page.click("#wizard-skip"); // skip dir
  await page.click("#wizard-skip"); // skip AI tool
  await expect(page.locator("#terminal-container")).toBeVisible({ timeout: 5000 });
});
