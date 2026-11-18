import { expect, test } from "@playwright/test";

const PROFILE_ID = "synthetic-e2e-user";

test("uses an isolated synthetic non-Tanner profile", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Alex Morgan" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Tanner C. Tucci");
  const response = await page.request.get(
    `/api/career-profiles/${PROFILE_ID}`,
  );
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("Alex Morgan");
});

test("reviews, approves, and reloads edits to the synthetic career profile", async ({ page }) => {
  test.skip(
    process.env.RESUME_RATT_E2E_PRODUCTION === "true",
    "Career profile Markdown edits are available only in the development server.",
  );
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Alex Morgan" })).toBeVisible();
  await expect(
    page.getByText("Product Reliability Engineer", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Madison, Wisconsin 53703")).toBeVisible();
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
      response.url().includes(`/api/career-profiles/${PROFILE_ID}`) &&
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
  const savedProfileResponse = await page.request.get(
    `/api/career-profiles/${PROFILE_ID}`,
  );
  expect(savedProfileResponse.ok()).toBe(true);
  const savedProfile = (await savedProfileResponse.json()) as {
    profile: { targetIdentity: string; searchTerms: Array<{ status: string }> };
  };
  expect(savedProfile.profile.targetIdentity).toBe(
    "Senior Systems Integration Engineer",
  );
  expect(savedProfile.profile.searchTerms.some((term) => term.status === "approved"))
    .toBe(true);

  await page.reload();
  await expect(
    page.getByText("Senior Systems Integration Engineer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Reliability Platform Engineer", { exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByText("approved · ai")).toBeVisible();
});
