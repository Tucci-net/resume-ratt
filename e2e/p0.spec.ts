import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("autosaves resume content across a browser reload", async ({ page }) => {
  await page.goto("/resume");
  await waitForDrafts(page);
  await page.getByLabel("Full name").fill("Morgan Resume Test");
  await expect(page.locator(".resume-paper-page")).toContainText(
    "Morgan Resume Test",
  );
  await waitForStoredDraftValue(page, "Morgan Resume Test");

  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Morgan Resume Test");
  await expect(page.locator(".resume-paper-page")).toContainText(
    "Morgan Resume Test",
  );
});

test("reuses Career Library wording without changing canonical text", async ({
  page,
}) => {
  await page.goto("/resume");
  await waitForDrafts(page);
  await page.getByRole("button", { name: /Career Library/ }).click();
  await page.getByLabel("Canonical text", { exact: true }).fill(
    "Canonical accomplishment: reduced deployment time by 35%.",
  );
  await page.getByRole("button", { name: "Add to library" }).click();

  const itemCard = page
    .locator(".resume-editor-panel article")
    .filter({ hasText: "accomplishment · unverified" });
  await expect(itemCard).toBeVisible();
  await itemCard
    .getByLabel("Resume-specific wording")
    .fill("Improved release speed by 35% through automation.");
  await itemCard.getByRole("button", { name: "Add to resume" }).click();

  await expect(page.locator(".resume-paper-page")).toContainText(
    "Improved release speed by 35% through automation.",
  );
  await expect(itemCard.getByLabel("Canonical text")).toHaveValue(
    "Canonical accomplishment: reduced deployment time by 35%.",
  );
  await expect(page.getByText(/Added resume wording to Experience/)).toBeVisible();
  await expect(page.getByText(/copy · accomplishment/)).toBeVisible();
  await waitForStoredDraftValue(page, "Improved release speed by 35%");
  await page.waitForFunction(() =>
    localStorage
      .getItem("resume-ratt:career-library")
      ?.includes("Canonical accomplishment: reduced deployment time by 35%"),
  );

  await page.reload();
  await expect(page.locator(".resume-paper-page")).toContainText(
    "Improved release speed by 35% through automation.",
  );
  await page.getByRole("button", { name: /Career Library/ }).click();
  const persistedItem = page
    .locator(".resume-editor-panel article")
    .filter({ hasText: "accomplishment · unverified" });
  await expect(persistedItem.getByLabel("Canonical text")).toHaveValue(
    "Canonical accomplishment: reduced deployment time by 35%.",
  );
});

test("protects current evidence when importing a stale Career Library revision", async ({
  page,
}) => {
  await page.goto("/resume");
  await waitForDrafts(page);
  await page.getByRole("button", { name: /Career Library/ }).click();
  await page.getByLabel("Canonical text", { exact: true }).fill("Original canonical skill");
  await page.getByRole("button", { name: "Add to library" }).click();

  const itemCard = page
    .locator(".resume-editor-panel article")
    .filter({ hasText: "accomplishment · unverified" });
  const idText = await itemCard.locator("p").first().innerText();
  const stableId = idText.split("ID ")[1]?.toLowerCase();
  expect(stableId).toBeTruthy();

  const staleExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const exportedFile = await staleExport;
  const exportedPath = await exportedFile.path();
  expect(exportedPath).toBeTruthy();
  const staleLibraryJson = await readFile(exportedPath!, "utf8");

  await itemCard
    .getByLabel("Canonical text")
    .fill("Current canonical revision must be preserved");

  await page.getByLabel(/Import JSON \/ Markdown/).setInputFiles({
    name: "stale-library.json",
    mimeType: "application/json",
    buffer: Buffer.from(staleLibraryJson),
  });

  await expect(
    page.getByRole("status").filter({
      hasText: "protected 1 conflicting item",
    }),
  )
    .toBeVisible();
  await expect(itemCard.getByLabel("Canonical text")).toHaveValue(
    "Current canonical revision must be preserved",
  );
  await page.reload();
  await expect(page.getByText("Saved in this browser")).toBeVisible();
  await page.getByRole("button", { name: /Career Library/ }).click();
  const persistedItem = page
    .locator(".resume-editor-panel article")
    .filter({ hasText: "accomplishment · unverified" });
  await expect(persistedItem.getByLabel("Canonical text")).toHaveValue(
    "Current canonical revision must be preserved",
  );
});

test("persists section visibility and ordering", async ({ page }) => {
  await page.goto("/resume");
  await waitForDrafts(page);
  await page.getByRole("button", { name: /Page structure/ }).click();
  await page.getByRole("button", { name: "Hide Skills" }).click();
  await page.getByRole("button", { name: "Move Experience up" }).click();

  await page.waitForFunction(() => {
    const raw = localStorage.getItem("resume-ratt:drafts");
    if (!raw) return false;
    const store = JSON.parse(raw) as {
      drafts: Array<{
        sections: Array<{ id: string; visible: boolean }>;
      }>;
    };
    const sections = store.drafts[0]?.sections ?? [];
    return (
      sections[0]?.id === "experience" &&
      sections.find((section) => section.id === "skills")?.visible === false
    );
  });

  await page.reload();
  await page.getByRole("button", { name: /Page structure/ }).click();
  await expect(page.getByRole("button", { name: "Show Skills" })).toBeVisible();
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("resume-ratt:drafts");
    if (!raw) return false;
    const store = JSON.parse(raw) as {
      drafts: Array<{ sections: Array<{ id: string }> }>;
    };
    return store.drafts[0]?.sections[0]?.id === "experience";
  });
});

test("detects content overflow and honors print-only visibility", async ({
  page,
}) => {
  await page.goto("/resume");
  await waitForDrafts(page);
  await page.getByRole("textbox", { name: "Summary" }).fill(
    "Experienced professional delivering measurable outcomes. ".repeat(600),
  );

  await expect(page.locator(".resume-paper-page").nth(1)).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("status").filter({
      hasText: "Some content blocks are taller than one printable page",
    }),
  ).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".resume-editor-panel")).toBeHidden();
  await expect(page.locator(".resume-builder-header")).toBeHidden();
  await expect(page.locator(".resume-paper-page").nth(1)).toBeVisible();
});

async function waitForDrafts(page: import("@playwright/test").Page) {
  await expect(page.getByText("Saved in this browser")).toBeVisible({
    timeout: 10_000,
  });
}

async function waitForStoredDraftValue(
  page: import("@playwright/test").Page,
  value: string,
) {
  await page.waitForFunction(
    (expected) => localStorage.getItem("resume-ratt:drafts")?.includes(expected),
    value,
  );
}
