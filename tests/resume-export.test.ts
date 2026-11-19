import { describe, expect, it } from "vitest";
import { parseResumeMarkdown } from "../lib/resume/import";
import {
  selectResumePresentation,
  serializeResumeJson,
  serializeResumeMarkdown,
  serializeResumePlainText,
} from "../lib/resume/export";
import {
  DEFAULT_RESUME_DESIGN,
  DEFAULT_RESUME_SECTIONS,
  INITIAL_RESUME,
} from "../lib/resume/model";
import type { ResumeExportSource } from "../lib/resume/export";

const source: ResumeExportSource = {
  name: "Synthetic Resume",
  revision: 3,
  updatedAt: "2026-11-19T20:00:00.000Z",
  content: {
    ...INITIAL_RESUME,
    name: "Morgan Lee",
    headline: "Product Engineer",
    email: "morgan@example.test",
    website: "https://example.test/morgan",
    summary: "Builds resilient products.",
    experience: [
      {
        id: "experience-1",
        employer: "Example Co",
        jobTitle: "Engineer",
        location: "Remote",
        startDate: "2020",
        endDate: "",
        currentRole: true,
        accomplishments: ["Improved service uptime."],
      },
    ],
    projects: [
      {
        id: "project-1",
        name: "Telemetry",
        subtitle: "",
        startDate: "",
        endDate: "",
        url: "https://example.test/project",
        description: "An open-source tool.",
        accomplishments: [],
      },
    ],
    skills: "TypeScript, Testing",
    careerLibraryReferences: [
      {
        libraryItemId: "internal-evidence-id",
        type: "experience",
        section: "experience",
        relationship: "reference",
        resumeText: "internal canonical reference",
        canonicalRevisionId: "revision-internal",
        evidenceIds: ["private-evidence-id"],
      },
    ],
  },
  design: DEFAULT_RESUME_DESIGN,
  sections: [
    { id: "summary", visible: true },
    { id: "experience", visible: true },
    { id: "education", visible: true },
    { id: "projects", visible: true },
    { id: "skills", visible: true },
    { id: "certifications", visible: true },
  ],
};

describe("résumé exports", () => {
  it("serializes human-readable Markdown with links and no internal metadata", () => {
    const markdown = serializeResumeMarkdown(source);
    expect(markdown).toContain("# Morgan Lee");
    expect(markdown).toContain("## Experience");
    expect(markdown).toContain("## Projects");
    expect(markdown).toContain("[Website](https://example.test/morgan)");
    expect(markdown).toContain(
      "[https://example.test/project](https://example.test/project)",
    );
    expect(markdown).not.toContain("<br");
    expect(markdown).not.toContain("internal-evidence-id");
    expect(markdown).not.toContain("revision-internal");

    const imported = parseResumeMarkdown(markdown);
    expect(imported.map((candidate) => candidate.type)).toEqual([
      "contact",
      "summary",
      "experience",
      "project",
      "skill",
    ]);
    expect(imported[0]?.text).toContain("morgan@example.test");
    expect(imported[2]?.text).toContain("Improved service uptime.");
  });

  it("respects visible sections and ordering in Markdown, text, and JSON exports", () => {
    const sections = [
      { id: "projects", visible: true },
      { id: "summary", visible: false },
      { id: "experience", visible: true },
      { id: "education", visible: true },
      { id: "skills", visible: true },
      { id: "certifications", visible: true },
    ] as typeof DEFAULT_RESUME_SECTIONS;
    const customized = { ...source, sections };

    const markdown = serializeResumeMarkdown(customized);
    expect(markdown.indexOf("## Projects")).toBeLessThan(
      markdown.indexOf("## Experience"),
    );
    expect(markdown).not.toContain("## Summary");
    expect(markdown).not.toContain("Builds resilient products.");
    expect(serializeResumePlainText(customized)).not.toContain(
      "Builds resilient products.",
    );

    const json = JSON.parse(serializeResumeJson(customized)) as {
      version: number;
      draft: { revision: number };
      content: { summary: string; experience: unknown[]; projects: unknown[] };
    };
    expect(json.version).toBe(1);
    expect(json.draft.revision).toBe(3);
    expect(json.content.summary).toBe("");
    expect(json.content.experience).toHaveLength(1);
    expect(json.content.projects).toHaveLength(1);
    expect(JSON.stringify(json)).not.toContain("internal-evidence-id");
  });

  it("clears hidden content from the selected presentation", () => {
    const presentation = selectResumePresentation(source.content, [
      ...DEFAULT_RESUME_SECTIONS.map((section) => ({
        ...section,
        visible: section.id !== "experience",
      })),
    ]);
    expect(presentation.experience).toEqual([]);
    expect(presentation.summary).toBe(source.content.summary);
  });
});
