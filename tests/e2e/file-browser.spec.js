const { test, expect } = require("@playwright/test");

async function setupSession(page) {
  await page.goto("/");
  await expect(page.locator("#new-session-btn")).toBeVisible({ timeout: 3000 });
  await page.click("#new-session-btn");
  await expect(page.locator("#wizard-modal")).toBeVisible();
  await page.click("#wizard-skip");
  await page.click("#wizard-skip");
  await expect(page.locator("#terminal-container")).toBeVisible({ timeout: 5000 });

  // Switch to Files tab
  await page.click('.sidebar-tab[data-tab="files"]');
  await expect(page.locator("#sidebar-panel-files")).toBeVisible();
  await expect(page.locator("#file-tree .ft-item").first()).toBeVisible({ timeout: 5000 });
}

test("back button is disabled at session cwd root", async ({ page }) => {
  await setupSession(page);
  const backBtn = page.locator("#file-tree-back-btn");
  await expect(backBtn).toBeDisabled();
});

test("double-click folder changes file tree root", async ({ page }) => {
  await setupSession(page);
  const pathDisplay = page.locator("#file-tree-path");
  const initialPath = await pathDisplay.textContent();

  const dirItem = page.locator('.ft-item[data-type="directory"]').first();
  if (await dirItem.isVisible()) {
    const dirName = await dirItem.locator(".ft-name").textContent();
    await dirItem.dblclick();
    await expect(pathDisplay).not.toHaveText(initialPath, { timeout: 3000 });
    const newPath = await pathDisplay.textContent();
    expect(newPath).toContain(dirName);
  }
});

test("back button navigates to parent after drill-down", async ({ page }) => {
  await setupSession(page);
  const pathDisplay = page.locator("#file-tree-path");
  const initialPath = await pathDisplay.textContent();

  const dirItem = page.locator('.ft-item[data-type="directory"]').first();
  if (await dirItem.isVisible()) {
    await dirItem.dblclick();
    await expect(pathDisplay).not.toHaveText(initialPath, { timeout: 3000 });

    const backBtn = page.locator("#file-tree-back-btn");
    await expect(backBtn).toBeEnabled();
    await backBtn.click();
    await expect(pathDisplay).toHaveText(initialPath, { timeout: 3000 });
    await expect(backBtn).toBeDisabled();
  }
});
