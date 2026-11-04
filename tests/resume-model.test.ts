import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESUME_SECTIONS,
  DEFAULT_RESUME_DESIGN,
  INITIAL_RESUME,
  RESUME_FONTS,
} from "../lib/resume/model";

describe("resume content defaults", () => {
  it("starts with separate empty content collections", () => {
    expect(INITIAL_RESUME.experience).toEqual([]);
    expect(INITIAL_RESUME.education).toEqual([]);
    expect(INITIAL_RESUME.projects).toEqual([]);
    expect(INITIAL_RESUME.certifications).toEqual([]);
    expect(INITIAL_RESUME.skills).toBe("");
  });

  it("uses the requested visible default section order", () => {
    expect(DEFAULT_RESUME_SECTIONS).toEqual([
      { id: "summary", visible: true },
      { id: "experience", visible: true },
      { id: "education", visible: true },
      { id: "projects", visible: true },
      { id: "skills", visible: true },
      { id: "certifications", visible: true },
    ]);
  });
});

describe("resume design defaults", () => {
  it("includes the curated serif and sans-serif font options", () => {
    expect(RESUME_FONTS.map((font) => font.name)).toEqual([
      "Inter",
      "Roboto",
      "Open Sans",
      "Source Sans 3",
      "Lato",
      "Merriweather",
      "Libre Baskerville",
      "EB Garamond",
    ]);
    expect(RESUME_FONTS.every((font) => font.googleFontsUrl)).toBe(true);
  });

  it("starts with resume-friendly typography defaults", () => {
    expect(DEFAULT_RESUME_DESIGN).toEqual({
      fontFamily: "inter",
      bodyFontSize: 10,
      headingScale: 2,
      lineHeight: 1.4,
      sectionSpacing: 18,
    });
  });
});
