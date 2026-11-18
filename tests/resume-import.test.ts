import { describe, expect, it } from "vitest";
import { parseResumeJson, parseResumeText } from "../lib/resume/import";

describe("résumé import parsing", () => {
  it("recognizes common section headings and keeps each section's content", () => {
    const candidates = parseResumeText(`# Profile
Product designer with a focus on accessibility.

Employment
Senior Designer — Acme
- Improved onboarding completion by 20%.

Education:
BS, Design — State University

Projects
Open-source design system

Skills
Figma, Research, Prototyping

Certifications
Accessibility Specialist`);

    expect(candidates.map(({ type, text }) => [type, text])).toEqual([
      ["summary", "Product designer with a focus on accessibility."],
      ["experience", "Senior Designer — Acme\nImproved onboarding completion by 20%."],
      ["education", "BS, Design — State University"],
      ["project", "Open-source design system"],
      ["skill", "Figma, Research, Prototyping"],
      ["certification", "Accessibility Specialist"],
    ]);
  });

  it("parses recognized fields from a JSON résumé without saving it", () => {
    const candidates = parseResumeJson(
      JSON.stringify({
        summary: "Experienced engineer",
        experience: [{ title: "Engineer", company: "Example Co" }],
        skills: ["TypeScript", "React"],
      }),
    );

    expect(candidates.map(({ type }) => type)).toEqual([
      "summary",
      "experience",
      "skill",
    ]);
    expect(candidates[1]?.text).toContain("company: Example Co");
  });

  it("rejects JSON without recognizable résumé fields", () => {
    expect(() => parseResumeJson('{"name":"Sam"}')).toThrow(
      "must include summary",
    );
  });
});
