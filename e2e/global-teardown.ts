import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export default async function globalTeardown() {
  const tempRoot = path.resolve(os.tmpdir());
  const configuredDirectory = process.env.RESUME_RATT_E2E_PROFILE_DIRECTORY;
  if (!configuredDirectory) {
    throw new Error("The isolated E2E profile directory is not configured.");
  }
  const directory = path.resolve(configuredDirectory);
  if (
    path.dirname(directory) !== tempRoot ||
    !path.basename(directory).startsWith("resume-ratt-e2e-")
  ) {
    throw new Error("Refusing to remove an unexpected E2E profile directory.");
  }
  await rm(directory, { recursive: true, force: true });
}
