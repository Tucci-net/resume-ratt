import { expect, test } from "@playwright/test";

test("serves the homepage and resume builder", async ({ request }) => {
  const [homeResponse, builderResponse] = await Promise.all([
    request.get("/"),
    request.get("/dashboard"),
  ]);
  const [home, builder] = await Promise.all([
    homeResponse.text(),
    builderResponse.text(),
  ]);

  expect(homeResponse.ok()).toBe(true);
  expect(home).toContain("Job hunting is a rat race.");
  expect(builderResponse.ok()).toBe(true);
  expect(builder).toContain("Print / Save as PDF");
  expect(builder).toContain("Your details");
  expect(builder).toContain("Education");
  expect(builder).toContain("Projects");
  expect(builder).toContain("Certifications");
  expect(builder).toContain("Page structure");
  expect(builder).toContain('aria-expanded="false"');
  expect(builder).toContain("Design");
  expect(builder).toContain("ATS Safe v1");
  expect(builder).toContain("Plain-text preview");
  expect(builder).toContain("Upload .ttf");
});
