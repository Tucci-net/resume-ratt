import { expect, test } from "@playwright/test";

const PROFILE_ID = "synthetic-e2e-user";

test("reviews and persists a search decision separately from the CareerProfile", async ({
  page,
}) => {
  test.skip(
    process.env.RESUME_RATT_E2E_PRODUCTION === "true",
    "Search preference Markdown edits are available only in the development server.",
  );
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
      response.url().includes(`/api/search-strategies/${PROFILE_ID}`) &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save search decisions" }).click();
  expect((await saveResponse).ok()).toBe(true);
  await expect(
    page.getByRole("status").getByText(/Search preferences saved/),
  ).toBeVisible();

  const [savedStrategyResponse, profileMarkdownResponse] = await Promise.all([
    page.request.get(`/api/search-strategies/${PROFILE_ID}`),
    page.request.get(`/api/career-profiles/${PROFILE_ID}?format=markdown`),
  ]);
  expect(savedStrategyResponse.ok()).toBe(true);
  expect(profileMarkdownResponse.ok()).toBe(true);
  const savedStrategy = (await savedStrategyResponse.json()) as {
    preferences: {
      terms: Array<{ value: string; status: string }>;
    };
  };
  const profileMarkdown = await profileMarkdownResponse.text();
  expect(
    savedStrategy.preferences.terms.some(
      (term) =>
        term.value === "QA Search Strategy Engineer" &&
        term.status === "approved",
    ),
  ).toBe(true);
  expect(profileMarkdown).not.toContain("QA Search Strategy Engineer");

  await page.reload();
  await expect(
    page.getByText("QA Search Strategy Engineer", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Planned query preview", { exact: true }),
  ).toBeVisible();
});
