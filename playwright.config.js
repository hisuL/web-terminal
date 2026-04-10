const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3456",
    headless: true,
    channel: "chrome",
  },
  projects: [
    {
      name: "chromium",
      use: { channel: "chrome" },
    },
  ],
  webServer: {
    command: "node server.js",
    port: 3456,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
