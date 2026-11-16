import { expect, test } from "@playwright/test";

test("cancels draft deletion by button, Escape, and backdrop", async ({
  page,
}) => {
  await page.goto("/resume");
  await expect(page.getByText("Saved in this browser")).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "New draft" }).click();
  await expect(page.getByLabel("Draft name")).not.toHaveValue("My Resume");
  const trigger = page.getByRole("button", { name: "Delete", exact: true });

  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "Delete resume?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "This action cannot be undone.",
  );
  const cancel = dialog.getByRole("button", { name: "Keep resume" });
  const confirm = dialog.getByRole("button", { name: "Delete resume" });
  await expect(cancel).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();

  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel("Draft name")).not.toHaveValue("My Resume");
});

test("deletes a draft only after explicit confirmation", async ({ page }) => {
  await page.goto("/resume");
  await expect(page.getByText("Saved in this browser")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "New draft" }).click();
  const nameInput = page.getByLabel("Draft name");
  await expect(nameInput).not.toHaveValue("My Resume");
  const draftName = await nameInput.inputValue();
  const trigger = page.getByRole("button", { name: "Delete", exact: true });

  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "Delete resume?" });
  await expect(dialog).toContainText(`“${draftName}”`);
  await dialog.getByRole("button", { name: "Delete resume" }).dblclick();
  await expect(dialog).toBeHidden();

  await expect(page.getByLabel("Draft name")).toHaveValue("My Resume");
  await expect(
    page.getByLabel("Resume draft").locator("option", { hasText: draftName }),
  ).toHaveCount(0);
  await page.waitForFunction(
    (deletedName) => {
      const raw = localStorage.getItem("resume-ratt:drafts");
      if (!raw) return false;
      const store = JSON.parse(raw) as {
        drafts: Array<{ name: string }>;
      };
      return !store.drafts.some((draft) => draft.name === deletedName);
    },
    draftName,
  );
});

test("closes immediately when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/resume");
  await expect(page.getByText("Saved in this browser")).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete resume?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("transition-duration", "0s");
  await dialog.getByRole("button", { name: "Keep resume" }).click();
  await expect(dialog).toBeHidden();
});
