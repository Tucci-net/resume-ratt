import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export default async function globalTeardown() {
  const tempRoot = path.resolve(os.tmpdir());
  const directory = path.resolve(tempRoot, "resume-ratt-e2e-profile");
  if (
    path.dirname(directory) !== tempRoot ||
    path.basename(directory) !== "resume-ratt-e2e-profile"
  ) {
    throw new Error("Refusing to remove an unexpected E2E profile directory.");
  }
  await rm(directory, { recursive: true, force: true });
}
