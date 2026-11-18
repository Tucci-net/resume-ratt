import { defineConfig } from "@playwright/test";
import { copyFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const careerProfileDirectory = mkdtempSync(
  path.join(os.tmpdir(), "resume-ratt-e2e-"),
);
const useDevelopmentServer =
  process.env.RESUME_RATT_E2E_DEVELOPMENT === "true";
copyFileSync(
  path.join(
    process.cwd(),
    "e2e",
    "fixtures",
    "profile-synthetic-e2e-user.md",
  ),
  path.join(careerProfileDirectory, "synthetic-e2e-user.md"),
);
process.env.CAREER_PROFILE_DIRECTORY = careerProfileDirectory;
process.env.CAREER_PROFILE_ID = "synthetic-e2e-user";
process.env.RESUME_RATT_E2E_PROFILE_DIRECTORY = careerProfileDirectory;
process.env.RESUME_RATT_E2E_PRODUCTION = String(!useDevelopmentServer);

export default defineConfig({
  testDir: "./e2e",
  reporter: "list",
  globalTeardown: "./e2e/global-teardown.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3219",
  },
  webServer: {
    command: useDevelopmentServer
      ? "NODE_ENV=development pnpm dev --hostname 127.0.0.1 --port 3219"
      : "NODE_ENV=production pnpm build && NODE_ENV=production pnpm start --hostname 127.0.0.1 --port 3219",
    url: "http://127.0.0.1:3219",
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      CAREER_PROFILE_DIRECTORY: careerProfileDirectory,
      CAREER_PROFILE_ID: "synthetic-e2e-user",
      RESUME_RATT_E2E_PROFILE_DIRECTORY: careerProfileDirectory,
      RESUME_RATT_E2E_PRODUCTION: String(!useDevelopmentServer),
      NODE_ENV: useDevelopmentServer ? "development" : "production",
    },
  },
});
