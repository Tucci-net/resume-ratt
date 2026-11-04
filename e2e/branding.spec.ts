import { expect, test } from "@playwright/test";

const LOGO_ALT = "Resume Ratt — Indie Contractor Tools";

test("uses responsive light and dark brand logos and the SVG favicon", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const favicon = page.locator('link[rel="icon"]');
  await expect(favicon).toHaveAttribute("href", "/resume-ratt-mark.svg");
  await expect(favicon).toHaveAttribute("type", "image/svg+xml");
  const faviconResponse = await page.request.get("/resume-ratt-mark.svg");
  expect(faviconResponse.ok()).toBe(true);
  expect(faviconResponse.headers()["content-type"]).toContain("image/svg+xml");

  const logos = page.locator(`header img[alt="${LOGO_ALT}"]`);
  const dayLogo = logos.nth(0);
  const nightLogo = logos.nth(1);
  await expect(dayLogo).toBeVisible();
  await expect(nightLogo).toBeHidden();

  const dayBounds = await dayLogo.boundingBox();
  expect(dayBounds).not.toBeNull();
  expect(dayBounds!.width).toBeLessThanOrEqual(375);
  expect(dayBounds!.width / dayBounds!.height).toBeCloseTo(497 / 94, 0);

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(dayLogo).toBeHidden();
  await expect(nightLogo).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard");
  const sidebarLogos = page.locator(
    `.dashboard-sidebar img[alt="${LOGO_ALT}"]`,
  );
  await expect(sidebarLogos.nth(0)).toBeHidden();
  await expect(sidebarLogos.nth(1)).toBeVisible();
});
