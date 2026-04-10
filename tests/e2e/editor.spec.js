const { test, expect } = require("@playwright/test");

async function openFileInEditor(page) {
  await page.goto("/");
  // Create session via wizard, selecting a directory with known files
  await expect(page.locator("#new-session-btn")).toBeVisible({ timeout: 3000 });
  await page.click("#new-session-btn");
  await expect(page.locator("#wizard-modal")).toBeVisible();

  // In the dir browser, navigate to the web-terminal project dir
  await expect(page.locator(".dir-browser")).toBeVisible({ timeout: 3000 });
  // Find and click the claudeworkspace dir
  const cwDir = page.locator(".dir-item", { hasText: "claudeworkspace" });
  if (await cwDir.isVisible()) {
    await cwDir.dblclick();
    await page.waitForTimeout(300);
    // Find web-terminal
    const wtDir = page.locator(".dir-item", { hasText: "web-terminal" });
    if (await wtDir.isVisible()) {
      await wtDir.click();
      await page.waitForTimeout(300);
    }
  }

  // Continue through wizard
  await page.click("#wizard-next"); // next step (dir selected or current)
  await page.click("#wizard-skip"); // skip AI tool
  await expect(page.locator("#terminal-container")).toBeVisible({ timeout: 5000 });

  // Switch to Files tab
  await page.click('.sidebar-tab[data-tab="files"]');
  await expect(page.locator("#sidebar-panel-files")).toBeVisible();
  await expect(page.locator("#file-tree .ft-item").first()).toBeVisible({ timeout: 5000 });

  // Find a file to open (package.json, server.js, etc.)
  const fileItem = page.locator('.ft-item[data-type="file"]').first();
  await expect(fileItem).toBeVisible({ timeout: 5000 });
  await fileItem.click();
  await expect(page.locator("#editor-container")).toBeVisible({ timeout: 5000 });
}

test("file opens in read-only mode by default", async ({ page }) => {
  await openFileInEditor(page);
  await expect(page.locator("#editor-save-status")).toContainText("Read-Only");
  await expect(page.locator("#editor-edit-btn")).toContainText("Read-Only");
  await expect(page.locator(".cm-editor")).toBeVisible();
});

test("edit button toggles to edit mode", async ({ page }) => {
  await openFileInEditor(page);
  await page.click("#editor-edit-btn");
  await expect(page.locator("#editor-edit-btn")).toContainText("Editing");
  await expect(page.locator("#editor-edit-btn")).toHaveClass(/editing/);
  await expect(page.locator("#editor-save-status")).not.toContainText("Read-Only");
});

test("toggling back to read-only works", async ({ page }) => {
  await openFileInEditor(page);
  await page.click("#editor-edit-btn");
  await expect(page.locator("#editor-edit-btn")).toContainText("Editing");
  await page.click("#editor-edit-btn");
  await expect(page.locator("#editor-edit-btn")).toContainText("Read-Only");
  await expect(page.locator("#editor-save-status")).toContainText("Read-Only");
});
