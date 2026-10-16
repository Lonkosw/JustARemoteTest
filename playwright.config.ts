import { defineConfig, devices } from "@playwright/test";

// Two modes:
//   default     - "local" project: app built without Supabase (local mode)
//   SYNC_E2E=1  - "sync" project: app built against the local test backend
//                 (scripts/test-backend); see `npm run test:sync`
const SYNC = process.env.SYNC_E2E === "1";
const CI = !!process.env.CI;

const LOCAL_PORT = 3100;
const SYNC_PORT = 3200;
const SYNC_BACKEND_URL = "http://127.0.0.1:54321";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: SYNC
    ? [{ name: "sync", testMatch: /sync\.spec\.ts/, use: { baseURL: `http://localhost:${SYNC_PORT}` } }]
    : [{ name: "local", testIgnore: /sync\.spec\.ts/, use: { baseURL: `http://localhost:${LOCAL_PORT}` } }],
  // Each mode builds into its own directory and sets the Supabase env
  // explicitly (preset vars win over .env files), so a dev build or
  // .env.local never leaks into the tests.
  webServer: SYNC
    ? {
        command: `next build && next start -p ${SYNC_PORT}`,
        url: `http://localhost:${SYNC_PORT}`,
        env: {
          NEXT_DIST_DIR: ".next-sync",
          NEXT_PUBLIC_SUPABASE_URL: SYNC_BACKEND_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        },
        reuseExistingServer: !CI,
        timeout: 240_000,
      }
    : {
        command: `next build && next start -p ${LOCAL_PORT}`,
        url: `http://localhost:${LOCAL_PORT}`,
        env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
        reuseExistingServer: !CI,
        timeout: 240_000,
      },
});
