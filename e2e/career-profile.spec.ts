import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("loads, reviews, approves, and reloads a Markdown career profile", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Tanner C. Tucci" })).toBeVisible();
  await expect(
    page.getByText("Full-Stack Systems Engineer", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Portland, Oregon 97212")).toBeVisible();
  await expect(page.getByText("Compensation rules")).toBeVisible();
  await expect(
    page.getByText("No source providers are configured for this profile."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).click();
  const identityField = page.getByLabel("Target career identity");
  await identityField.fill("Senior Systems Integration Engineer");
  await page
    .getByLabel("New suggested search term")
    .fill("Reliability Platform Engineer");
  await page.getByLabel("Suggestion source").selectOption("ai");
  await page.getByRole("button", { name: "Add pending" }).click();
  await expect(page.getByText("pending · ai")).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("approved · ai")).toBeVisible();

  await page.getByRole("button", { name: "Review & approve changes" }).click();
  const approvalDialog = page.getByRole("alertdialog", {
    name: "Approve profile changes?",
  });
  await expect(approvalDialog).toBeVisible();
  await approvalDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(approvalDialog).toBeHidden();

  await page.getByRole("button", { name: "Review & approve changes" }).click();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/career-profiles/profile-tanner") &&
      response.request().method() === "PATCH",
  );
  await page
    .getByRole("alertdialog", { name: "Approve profile changes?" })
    .getByRole("button", { name: "Approve & save" })
    .click();
  expect((await saveResponse).ok()).toBe(true);

  await expect(
    page.getByText("Senior Systems Integration Engineer", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("approved · ai")).toBeVisible();
  const savedMarkdown = await readFile(
    path.join(os.tmpdir(), "resume-ratt-e2e-profile", "profile-tanner.md"),
    "utf8",
  );
  expect(savedMarkdown).toContain(
    "targetIdentity: Senior Systems Integration Engineer",
  );
  expect(savedMarkdown).toContain("status: approved");

  await page.reload();
  await expect(
    page.getByText("Senior Systems Integration Engineer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Reliability Platform Engineer", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("approved · ai")).toBeVisible();
});
