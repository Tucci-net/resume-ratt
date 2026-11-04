import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESUME_SECTIONS,
  INITIAL_RESUME,
} from "../lib/resume/model";
import {
  addResumeEntry,
  hasResumeSectionContent,
  moveResumeSection,
  removeResumeEntry,
  resetResumeSectionOrder,
  setResumeSectionVisibility,
} from "../lib/resume/sections";

describe("resume section configuration", () => {
  it("moves sections in either direction and leaves boundaries unchanged", () => {
    const reordered = moveResumeSection(
      DEFAULT_RESUME_SECTIONS,
      "projects",
      -1,
    );

    expect(reordered.map((section) => section.id)).toEqual([
      "summary",
      "experience",
      "projects",
      "education",
      "skills",
      "certifications",
    ]);
    expect(moveResumeSection(reordered, "summary", -1)).toBe(reordered);
    expect(moveResumeSection(reordered, "certifications", 1)).toBe(reordered);
  });

  it("changes visibility without changing section order", () => {
    const hidden = setResumeSectionVisibility(
      DEFAULT_RESUME_SECTIONS,
      "education",
      false,
    );

    expect(hidden.map((section) => section.id)).toEqual(
      DEFAULT_RESUME_SECTIONS.map((section) => section.id),
    );
    expect(hidden.find((section) => section.id === "education")?.visible).toBe(
      false,
    );
  });

  it("restores the default order while preserving visibility choices", () => {
    const changed = setResumeSectionVisibility(
      moveResumeSection(DEFAULT_RESUME_SECTIONS, "projects", -1),
      "education",
      false,
    );
    const reset = resetResumeSectionOrder(changed);
    reset[0]!.visible = false;

    expect(resetResumeSectionOrder(changed)).toEqual([
      { id: "summary", visible: true },
      { id: "experience", visible: true },
      { id: "education", visible: false },
      { id: "projects", visible: true },
      { id: "skills", visible: true },
      { id: "certifications", visible: true },
    ]);
  });

  it("detects meaningful content per section and ignores whitespace", () => {
    expect(hasResumeSectionContent(INITIAL_RESUME, "education")).toBe(false);
    expect(
      hasResumeSectionContent(
        {
          ...INITIAL_RESUME,
          education: [
            {
              id: "education-1",
              institution: "  ",
              degree: " ",
              fieldOfStudy: "",
              location: "",
              startDate: "",
              endDate: "",
              currentlyEnrolled: false,
              gpa: "",
              honors: " ",
            },
          ],
        },
        "education",
      ),
    ).toBe(false);
    expect(
      hasResumeSectionContent(
        {
          ...INITIAL_RESUME,
          projects: [
            {
              id: "project-1",
              name: " ",
              subtitle: "",
              startDate: "",
              endDate: "",
              url: "",
              description: "  ",
              accomplishments: [" "],
            },
          ],
        },
        "projects",
      ),
    ).toBe(false);
  });
});

describe("resume entry collection helpers", () => {
  it("adds and removes education, project, and certification records", () => {
    const education = {
      id: "education-1",
      institution: "Example University",
      degree: "B.S.",
      fieldOfStudy: "Design",
      location: "",
      startDate: "",
      endDate: "",
      currentlyEnrolled: false,
      gpa: "",
      honors: "",
    };
    const project = {
      id: "project-1",
      name: "Portfolio",
      subtitle: "",
      startDate: "",
      endDate: "",
      url: "",
      description: "",
      accomplishments: [],
    };
    const certification = {
      id: "certification-1",
      name: "Example Certificate",
      issuer: "Example Organization",
      issueDate: "",
      expirationDate: "",
      credentialId: "",
      credentialUrl: "",
    };

    expect(removeResumeEntry(addResumeEntry([], education), education.id)).toEqual(
      [],
    );
    expect(removeResumeEntry(addResumeEntry([], project), project.id)).toEqual(
      [],
    );
    expect(
      removeResumeEntry(
        addResumeEntry([], certification),
        certification.id,
      ),
    ).toEqual([]);
  });
});
