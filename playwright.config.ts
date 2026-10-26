import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "edge-desktop", use: { ...devices["Desktop Edge"], channel: "msedge" } }],
  webServer: [
    { command: "node tests/e2e/supabase-fixture.mjs", url: "http://127.0.0.1:54329/__test/health", reuseExistingServer: !process.env.CI, timeout: 30_000 },
    {
      command: "corepack.cmd pnpm exec next dev --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100/login",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key-not-a-secret",
      },
    },
  ],
});
