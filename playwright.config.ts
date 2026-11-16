import { defineConfig } from "@playwright/test";
import { copyFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const careerProfileDirectory = path.join(
  os.tmpdir(),
  "resume-ratt-e2e-profile",
);
mkdirSync(careerProfileDirectory, { recursive: true });
copyFileSync(
  path.join(process.cwd(), "profiles", "profile-tanner.md"),
  path.join(careerProfileDirectory, "profile-tanner.md"),
);
process.env.CAREER_PROFILE_DIRECTORY = careerProfileDirectory;
process.env.CAREER_PROFILE_ID = "profile-tanner";

export default defineConfig({
  testDir: "./e2e",
  reporter: "list",
  globalTeardown: "./e2e/global-teardown.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3219",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3219",
    url: "http://127.0.0.1:3219",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CAREER_PROFILE_DIRECTORY: careerProfileDirectory,
      CAREER_PROFILE_ID: "profile-tanner",
    },
  },
});
