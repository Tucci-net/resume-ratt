import { describe, expect, it } from "vitest";
import {
  parseResumeJson,
  parseResumeMarkdown,
  parseResumeText,
} from "../lib/resume/import";

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

  it("marks restricted JSON evidence for exclusion from default review selection", () => {
    const candidates = parseResumeJson(
      JSON.stringify({
        experience: [
          { title: "Engineer", company: "Example Co" },
          {
            title: "Internal project",
            company: "Example Co",
            restricted: true,
          },
        ],
      }),
    );

    expect(candidates.map(({ text, restricted }) => [text, restricted])).toEqual([
      ["title: Engineer\ncompany: Example Co", false],
      ["title: Internal project\ncompany: Example Co", true],
    ]);
  });

  it("parses exported Markdown contact details and conventional section headings", () => {
    const candidates = parseResumeMarkdown(`# Morgan Lee
Headline: Product Engineer
Email: morgan@example.test
Website: [Website](https://example.test/morgan)

## Summary

Builds resilient products.

## Experience

### Engineer — Example Co
Location: Remote
Dates: 2020 – Present
- Improved service uptime.

## Skills

TypeScript, Testing`);

    expect(
      candidates.map(({ type, section, text }) => [type, section, text]),
    ).toEqual([
      [
        "contact",
        "Contact",
        "Name: Morgan Lee\nHeadline: Product Engineer\nEmail: morgan@example.test\nWebsite: [Website](https://example.test/morgan)",
      ],
      ["summary", "Summary", "Builds resilient products."],
      [
        "experience",
        "Experience",
        "### Engineer — Example Co\nLocation: Remote\nDates: 2020 – Present\nImproved service uptime.",
      ],
      ["skill", "Skills", "TypeScript, Testing"],
    ]);
  });

  it("rejects JSON without recognizable résumé fields", () => {
    expect(() => parseResumeJson('{"name":"Sam"}')).toThrow(
      "must include summary",
    );
  });
});
