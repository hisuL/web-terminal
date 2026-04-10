const { test, expect } = require("@playwright/test");

async function openWizard(page) {
  await page.goto("/");
  await expect(page.locator("#new-session-btn")).toBeVisible({ timeout: 3000 });
  await page.click("#new-session-btn");
  await expect(page.locator("#wizard-modal")).toBeVisible();
}

test("wizard back button is prominent and functional", async ({ page }) => {
  await openWizard(page);
  await expect(page.locator(".dir-browser")).toBeVisible({ timeout: 3000 });

  const dirItem = page.locator(".dir-item").first();
  if (await dirItem.isVisible()) {
    await dirItem.dblclick();
    const backBtn = page.locator(".dir-back-btn");
    await expect(backBtn).toBeVisible({ timeout: 3000 });
    const text = await backBtn.textContent();
    expect(text).toContain("←");
    expect(text).toContain("返回");
  }
});

test("selecting subdirectory updates Next button", async ({ page }) => {
  await openWizard(page);
  await expect(page.locator(".dir-browser")).toBeVisible({ timeout: 3000 });

  const nextBtn = page.locator("#wizard-next");
  const initialText = await nextBtn.textContent();

  const dirItem = page.locator(".dir-item").first();
  if (await dirItem.isVisible()) {
    await dirItem.click();
    await page.waitForTimeout(300);
    const updatedText = await nextBtn.textContent();
    expect(updatedText).not.toBe(initialText);
    expect(updatedText).toContain("下一步");
  }
});

test("wizard checkbox toggles exactly once per click", async ({ page }) => {
  await openWizard(page);
  await page.click("#wizard-skip"); // skip dir
  await expect(page.locator(".ai-tool-grid")).toBeVisible({ timeout: 3000 });

  await page.locator(".ai-tool-card").first().click();
  await expect(page.locator(".ai-opts-section.visible")).toBeVisible();

  const checkbox = page.locator('.ai-opt-row input[type="checkbox"]').first();
  await expect(checkbox).toBeVisible();

  const wasBefore = await checkbox.isChecked();
  await checkbox.click();
  const isAfter = await checkbox.isChecked();
  expect(isAfter).toBe(!wasBefore);
});
