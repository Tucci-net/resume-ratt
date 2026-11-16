import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("reviews and persists a search decision separately from the CareerProfile", async ({
  page,
}) => {
  await page.goto("/search-strategy");
  await expect(
    page.getByRole("heading", { name: "Search Strategy" }),
  ).toBeVisible();
  await expect(page.getByText("Your words", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Provider recommendations", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("no provider APIs or websites are contacted.", {
      exact: false,
    }),
  ).toBeVisible();

  await page
    .getByLabel("Add a custom title")
    .fill("QA Search Strategy Engineer");
  await page.getByRole("button", { name: "Add and approve title" }).click();
  await expect(
    page.getByText("QA Search Strategy Engineer", { exact: true }).first(),
  ).toBeVisible();

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/search-strategies/profile-tanner") &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save search decisions" }).click();
  expect((await saveResponse).ok()).toBe(true);
  await expect(
    page.getByRole("status").getByText(/Search preferences saved/),
  ).toBeVisible();

  const profileDirectory = path.join(os.tmpdir(), "resume-ratt-e2e-profile");
  const preferencesMarkdown = await readFile(
    path.join(profileDirectory, "profile-tanner", "search-preferences.md"),
    "utf8",
  );
  const careerProfileMarkdown = await readFile(
    path.join(profileDirectory, "profile-tanner.md"),
    "utf8",
  );
  expect(preferencesMarkdown).toContain("QA Search Strategy Engineer");
  expect(careerProfileMarkdown).not.toContain("QA Search Strategy Engineer");

  await page.reload();
  await expect(
    page.getByText("QA Search Strategy Engineer", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Planned query preview", { exact: true }),
  ).toBeVisible();
});
