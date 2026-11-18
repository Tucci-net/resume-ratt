import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("reviews plain-text résumé import before saving it to Career Library", async ({
  page,
}) => {
  const library = await openCareerLibrary(page);
  await library.getByRole("button", { name: "Import Resume" }).click();
  await library.getByLabel("Résumé text to import").fill(`Summary
Synthetic product engineer focused on reliable systems.

Experience
Staff Engineer — Example Labs
Improved API reliability by 30%.

Education
BS Computer Science — State University

Projects
Open-source observability tool

Skills
TypeScript, Playwright

Certifications
Cloud Reliability Certificate`);
  await library.getByRole("button", { name: "Review pasted text" }).click();
  await expect(library.getByRole("heading", { name: "Review Import" })).toBeVisible();
  await expect(library.getByRole("article")).toHaveCount(6);

  const beforeApproval = await page.evaluate(() => ({
    libraryItems: JSON.parse(
      localStorage.getItem("resume-ratt:career-library") ?? '{"items":[]}',
    ).items.length,
    draftSummary: JSON.parse(
      localStorage.getItem("resume-ratt:drafts") ?? '{"drafts":[{"resume":{}}]}',
    ).drafts[0]?.resume.summary ?? "",
  }));
  expect(beforeApproval).toEqual({ libraryItems: 0, draftSummary: "" });

  await library
    .getByRole("button", { name: "Approve and save selected items" })
    .click();
  await expect(
    library.getByRole("status").filter({ hasText: "Added 6 reviewed items" }),
  ).toBeVisible();
  await expect(page.locator(".resume-paper-page")).toContainText(
    "Synthetic product engineer focused on reliable systems.",
  );
  await page.waitForFunction(() => {
    const rawLibrary = localStorage.getItem("resume-ratt:career-library");
    const rawDrafts = localStorage.getItem("resume-ratt:drafts");
    if (!rawLibrary || !rawDrafts) return false;
    const items = JSON.parse(rawLibrary).items as unknown[];
    const drafts = JSON.parse(rawDrafts).drafts as Array<{
      resume: { summary: string };
    }>;
    return (
      items.length === 6 &&
      drafts[0]?.resume.summary.includes(
        "Synthetic product engineer focused on reliable systems.",
      )
    );
  });

  await page.reload();
  await expect(page.locator(".resume-paper-page")).toContainText(
    "Synthetic product engineer focused on reliable systems.",
  );
  await page.getByRole("button", { name: /Career Library/ }).click();
  const summaryItem = page
    .getByRole("region", { name: /Career Library/ })
    .locator("article")
    .filter({ hasText: "summary · unverified" });
  await expect(summaryItem.getByLabel("Canonical text")).toHaveValue(
    "Synthetic product engineer focused on reliable systems.",
  );
});

test("round-trips a Markdown résumé through review and Career Library export/import", async ({
  page,
}) => {
  const library = await openCareerLibrary(page);
  await library.getByRole("button", { name: "Import Resume" }).click();
  await library.getByLabel("Choose Markdown / JSON").setInputFiles({
    name: "synthetic-resume.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Summary\n\nMarkdown round-trip evidence"),
  });
  await expect(library.getByRole("heading", { name: "Review Import" })).toBeVisible();
  await expect(library.getByRole("article")).toHaveCount(1);
  await library
    .getByRole("button", { name: "Approve and save selected items" })
    .click();

  const itemCard = library
    .locator("article")
    .filter({ hasText: "summary · unverified" });
  const stableId = (await itemCard.locator("p").first().innerText())
    .split("ID ")[1]
    ?.toLowerCase();
  expect(stableId).toBeTruthy();

  const downloadPromise = page.waitForEvent("download");
  await library.getByRole("button", { name: "Export Markdown" }).click();
  const download = await downloadPromise;
  const exported = await readFile((await download.path())!, "utf8");
  expect(exported).toContain("Markdown round-trip evidence");

  await itemCard
    .getByRole("button", { name: "Delete summary library item" })
    .click();
  await expect(library.locator("article")).toHaveCount(0);
  await library.getByLabel("Import JSON / Markdown").setInputFiles({
    name: "career-library-round-trip.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(exported),
  });

  await expect(
    library.getByRole("status").filter({ hasText: "Imported 1" }),
  ).toBeVisible();
  const restoredCard = library
    .locator("article")
    .filter({ hasText: "summary · unverified" });
  await expect(restoredCard.locator("p").first()).toContainText(stableId!);
  await expect(restoredCard.getByLabel("Canonical text")).toHaveValue(
    "Markdown round-trip evidence",
  );

  await page.reload();
  await page.getByRole("button", { name: /Career Library/ }).click();
  const persistedCard = page
    .getByRole("region", { name: /Career Library/ })
    .locator("article")
    .filter({ hasText: "summary · unverified" });
  await expect(persistedCard.getByLabel("Canonical text")).toHaveValue(
    "Markdown round-trip evidence",
  );
});

test("keeps draft edits separate and flags a working draft after canonical changes", async ({
  page,
}) => {
  const library = await openCareerLibrary(page);
  await addLibraryItem(library, "summary", "Canonical product reliability evidence");
  const itemCard = library
    .locator("article")
    .filter({ hasText: "summary · unverified" });
  await itemCard
    .getByLabel("Resume-specific wording")
    .fill("Presentation wording selected for this application");
  await itemCard.getByRole("button", { name: "Add to resume" }).click();
  await expect(page.locator(".resume-paper-page")).toContainText(
    "Presentation wording selected for this application",
  );

  const summaryField = page.getByRole("textbox", { name: "Summary" });
  await summaryField.fill("A draft-only summary edit");
  await expect(page.locator(".resume-paper-page")).toContainText(
    "A draft-only summary edit",
  );
  await expect(itemCard.getByLabel("Canonical text")).toHaveValue(
    "Canonical product reliability evidence",
  );

  await itemCard
    .getByLabel("Canonical text")
    .fill("Canonical evidence revised in the Career Library");
  await expect(
    page.getByRole("status").filter({
      hasText: "Canonical Career Evidence changed for 1 linked item",
    }),
  ).toBeVisible();
  await expect(summaryField).toHaveValue("A draft-only summary edit");
  await expect(page.locator(".resume-paper-page")).toContainText(
    "A draft-only summary edit",
  );
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("resume-ratt:drafts");
    if (!raw) return false;
    const drafts = JSON.parse(raw).drafts as Array<{
      resume: { summary: string };
    }>;
    return drafts[0]?.resume.summary === "A draft-only summary edit";
  });

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Summary" })).toHaveValue(
    "A draft-only summary edit",
  );
  await expect(
    page.getByRole("status").filter({
      hasText: "Canonical Career Evidence changed for 1 linked item",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Career Library/ }).click();
  const persistedCard = page
    .getByRole("region", { name: /Career Library/ })
    .locator("article")
    .filter({ hasText: "summary · unverified" });
  await expect(persistedCard.getByLabel("Canonical text")).toHaveValue(
    "Canonical evidence revised in the Career Library",
  );
});

test("freezes submitted content and compares its evidence with the current Career Library", async ({
  page,
}) => {
  const library = await openCareerLibrary(page);
  await addLibraryItem(library, "summary", "Evidence text at submission");
  const itemCard = library
    .locator("article")
    .filter({ hasText: "summary · unverified" });
  await itemCard.getByRole("button", { name: "Add to resume" }).click();
  await page.getByLabel("Full name").fill("Alex Synthetic");
  await page.getByLabel("Target job or application ID").fill("application-e2e-42");
  await page.getByRole("button", { name: "Mark as submitted" }).click();

  const submittedSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Submitted Snapshots" }) });
  await expect(submittedSection).toBeVisible();
  await expect(submittedSection).toContainText("application-e2e-42");
  await expect(
    submittedSection.locator(".resume-paper-page").first(),
  ).toContainText("Evidence text at submission");

  await itemCard
    .getByLabel("Canonical text")
    .fill("Evidence text after the submission");
  await expect(
    submittedSection.getByText("Canonical evidence changed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Summary" }).fill(
    "Working draft wording after submission",
  );
  await expect(
    submittedSection.locator(".resume-paper-page").first(),
  ).toContainText("Evidence text at submission");
  await expect(submittedSection).toContainText(
    "Evidence text after the submission",
  );

  const snapshotId = await page.waitForFunction(() => {
    const raw = localStorage.getItem("resume-ratt:drafts");
    if (!raw) return null;
    const store = JSON.parse(raw) as {
      snapshots: Array<{
        id: string;
        targetApplicationId: string;
        content: { summary: string };
      }>;
    };
    const snapshot = store.snapshots.find(
      (entry) => entry.targetApplicationId === "application-e2e-42",
    );
    return snapshot?.content.summary === "Evidence text at submission"
      ? snapshot.id
      : null;
  });
  const id = await snapshotId.jsonValue();
  expect(typeof id).toBe("string");

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Summary" })).toHaveValue(
    "Working draft wording after submission",
  );
  await page.getByLabel("Submitted Snapshot").selectOption(String(id));
  const reloadedSnapshot = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Submitted Snapshots" }) });
  await expect(
    reloadedSnapshot.locator(".resume-paper-page").first(),
  ).toContainText("Evidence text at submission");
  await expect(reloadedSnapshot).toContainText(
    "Evidence text after the submission",
  );
});

test("rejects malformed Career Library Markdown and JSON without saving data", async ({
  page,
}) => {
  const library = await openCareerLibrary(page);
  await library.getByLabel("Import JSON / Markdown").setInputFiles({
    name: "malformed-library.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("Not a Career Library Markdown document"),
  });
  await expect(library.locator('p[role="alert"]')).toContainText(
    "missing YAML front matter",
  );
  await library.getByLabel("Import JSON / Markdown").setInputFiles({
    name: "malformed-library.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":'),
  });
  await expect(library.locator('p[role="alert"]')).toContainText(
    "not valid JSON",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("resume-ratt:career-library") ??
            '{"items":[]}',
        ).items.length,
    ),
  ).toBe(0);
  await expect(library.locator("article")).toHaveCount(0);
});

test("rejects malformed résumé Markdown and JSON before review or saving", async ({
  page,
}) => {
  const library = await openCareerLibrary(page);
  await library.getByRole("button", { name: "Import Resume" }).click();
  const importSection = library.getByRole("region", { name: "Import Resume" });
  await importSection.getByLabel("Choose Markdown / JSON").setInputFiles({
    name: "malformed-resume.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("---\nsummary: [unterminated\n---"),
  });
  await expect(importSection.locator('[role="alert"]')).toContainText(
    "No résumé sections were recognized",
  );
  await importSection.getByLabel("Choose Markdown / JSON").setInputFiles({
    name: "malformed-resume.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"summary":'),
  });
  await expect(importSection.locator('[role="alert"]')).toContainText(
    "not valid JSON",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("resume-ratt:career-library") ??
            '{"items":[]}',
        ).items.length,
    ),
  ).toBe(0);
  await expect(library.locator("article")).toHaveCount(0);
});

test("cancels résumé import without changing the draft or Career Library", async ({
  page,
}) => {
  const library = await openCareerLibrary(page);
  await library.getByRole("button", { name: "Import Resume" }).click();
  await library.getByLabel("Résumé text to import").fill(
    "Summary\nThis candidate must not be imported.",
  );
  await library.getByRole("button", { name: "Review pasted text" }).click();
  await expect(library.getByRole("heading", { name: "Review Import" })).toBeVisible();
  await library.getByRole("button", { name: "Close resume import" }).click();

  await expect(library.getByRole("heading", { name: "Review Import" })).toBeHidden();
  await expect(library.locator("article")).toHaveCount(0);
  await expect(page.locator(".resume-paper-page")).not.toContainText(
    "This candidate must not be imported.",
  );
  await page.reload();
  const savedCounts = await page.evaluate(() => ({
    library: JSON.parse(
      localStorage.getItem("resume-ratt:career-library") ?? '{"items":[]}',
    ).items.length,
    references: JSON.parse(
      localStorage.getItem("resume-ratt:drafts") ??
        '{"drafts":[{"resume":{"careerLibraryReferences":[]}}]}',
    ).drafts[0]?.resume.careerLibraryReferences.length,
  }));
  expect(savedCounts).toEqual({ library: 0, references: 0 });
});

test("excludes restricted résumé evidence from the default import selection", async ({
  page,
}) => {
  const library = await openCareerLibrary(page);
  await library.getByRole("button", { name: "Import Resume" }).click();
  await library.getByLabel("Choose Markdown / JSON").setInputFiles({
    name: "restricted-evidence.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        experience: [
          {
            title: "Public platform engineer",
            company: "Example Systems",
          },
          {
            title: "Confidential acquisition work",
            company: "Example Systems",
            restricted: true,
          },
        ],
      }),
    ),
  });

  const review = library.getByRole("heading", { name: "Review Import" }).locator("..");
  const candidates = review.locator("..").locator("article");
  await expect(candidates).toHaveCount(2);
  await expect(candidates.nth(0).getByRole("checkbox")).toBeChecked();
  await expect(candidates.nth(1).getByRole("checkbox")).not.toBeChecked();
  await expect(candidates.nth(1)).toContainText(
    "Restricted evidence · excluded by default",
  );

  await library
    .getByRole("button", { name: "Approve and save selected items" })
    .click();
  await expect(page.locator(".resume-paper-page")).toContainText(
    "Public platform engineer",
  );
  await expect(page.locator(".resume-paper-page")).not.toContainText(
    "Confidential acquisition work",
  );
  await expect(
    library.getByRole("status").filter({ hasText: "Added 1 reviewed item" }),
  ).toBeVisible();
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("resume-ratt:career-library");
    if (!raw) return false;
    const items = JSON.parse(raw).items as Array<{ restricted?: boolean }>;
    return items.length === 1 && !items[0]?.restricted;
  });
});

async function openCareerLibrary(
  page: import("@playwright/test").Page,
) {
  await page.goto("/resume");
  await expect(page.getByText("Saved in this browser")).toBeVisible();
  await page.getByRole("button", { name: /Career Library/ }).click();
  const library = page.getByRole("region", { name: /Career Library/ });
  await expect(
    library.getByRole("button", { name: "Import Resume" }),
  ).toBeVisible();
  return library;
}

async function addLibraryItem(
  library: import("@playwright/test").Locator,
  type: string,
  text: string,
) {
  await library.getByRole("combobox", { name: "Type" }).selectOption(type);
  await library
    .getByRole("textbox", { name: "Canonical text" })
    .first()
    .fill(text);
  await library.getByRole("button", { name: "Add to library" }).click();
  await expect(
    library.getByRole("status").filter({ hasText: "Added to the Career Library" }),
  ).toBeVisible();
}
