import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESUME_SECTIONS,
  INITIAL_RESUME,
} from "../lib/resume/model";
import {
  ATS_SAFE_V1_CONTRACT,
  generateAtsPlainText,
  validateAtsSafeV1,
} from "../lib/resume/ats-safe";
import { RESUME_SECTION_LABELS } from "../lib/resume/sections";

describe("ATS Safe v1 contract", () => {
  it("defines semantic single-column text and canonical headings", () => {
    expect(ATS_SAFE_V1_CONTRACT.columns).toBe(1);
    expect(ATS_SAFE_V1_CONTRACT.semanticReadingOrder).toBe(true);
    expect(ATS_SAFE_V1_CONTRACT.selectableText).toBe(true);
    expect(RESUME_SECTION_LABELS).toEqual({
      summary: "Summary",
      experience: "Experience",
      education: "Education",
      projects: "Projects",
      skills: "Skills",
      certifications: "Certifications",
    });
  });

  it("generates plain text in header then configured section order", () => {
    const sections = [
      { id: "skills" as const, visible: true },
      { id: "summary" as const, visible: true },
      ...DEFAULT_RESUME_SECTIONS.filter(
        (section) => section.id !== "skills" && section.id !== "summary",
      ),
    ];
    const resume = {
      ...INITIAL_RESUME,
      name: "Jordan Lee",
      email: "jordan@example.com",
      summary: "Product designer with accessibility experience.",
      skills: "Figma, Research",
    };

    expect(generateAtsPlainText(resume, sections)).toBe(
      [
        "Jordan Lee",
        "jordan@example.com",
        "",
        "Skills",
        "Figma, Research",
        "",
        "Summary",
        "Product designer with accessibility experience.",
      ].join("\n"),
    );
  });

  it("keeps entry details and real text bullets in document reading order", () => {
    const resume = {
      ...INITIAL_RESUME,
      name: "Jordan Lee",
      experience: [
        {
          id: "role-1",
          employer: "Example Corp",
          jobTitle: "Engineer",
          location: "Seattle, WA",
          startDate: "2022",
          endDate: "",
          currentRole: true,
          accomplishments: ["Improved release reliability."],
        },
      ],
      education: [
        {
          id: "education-1",
          institution: "Example University",
          degree: "B.S.",
          fieldOfStudy: "Computer Science",
          location: "Seattle, WA",
          startDate: "2018",
          endDate: "2022",
          currentlyEnrolled: false,
          gpa: "",
          honors: "",
        },
      ],
    };

    const text = generateAtsPlainText(resume, DEFAULT_RESUME_SECTIONS);
    expect(text.indexOf("Experience")).toBeLessThan(text.indexOf("Education"));
    expect(text).toContain("Engineer | Example Corp | 2022 - Present");
    expect(text).toContain("• Improved release reliability.");
    expect(text).toContain(
      "Example University | 2018 - 2022\nB.S., Computer Science\nSeattle, WA",
    );
  });

  it("flags missing contact, noncanonical headings, incomplete dates, empty sections, and unsafe links", () => {
    const resume = {
      ...INITIAL_RESUME,
      experience: [
        {
          id: "role-1",
          employer: "Example Corp",
          jobTitle: "Engineer",
          location: "",
          startDate: "2023",
          endDate: "",
          currentRole: false,
          accomplishments: [],
        },
      ],
      website: "javascript:alert(1)",
    };
    const findings = validateAtsSafeV1(resume, DEFAULT_RESUME_SECTIONS, {
      headingLabels: { summary: "About Me" },
    });

    expect(findings.some((item) => item.ruleId === "contact-name" && item.severity === "error")).toBe(true);
    expect(findings.some((item) => item.ruleId === "section-heading" && item.severity === "warning")).toBe(true);
    expect(findings.some((item) => item.ruleId === "dates" && item.severity === "warning")).toBe(true);
    expect(findings.some((item) => item.ruleId === "empty-sections" && item.severity === "warning")).toBe(true);
    expect(findings.some((item) => item.ruleId === "links" && item.severity === "warning")).toBe(true);
  });

  it("warns when content is hidden and errors on duplicate reading-order sections", () => {
    const resume = { ...INITIAL_RESUME, summary: "Experienced developer." };
    const findings = validateAtsSafeV1(resume, [
      { id: "summary", visible: false },
      { id: "summary", visible: true },
      ...DEFAULT_RESUME_SECTIONS.filter((section) => section.id !== "summary"),
    ]);

    expect(findings.some((item) => item.ruleId === "hidden-content")).toBe(true);
    expect(
      findings.find((item) => item.ruleId === "reading-order")?.severity,
    ).toBe("error");
  });

  it("accepts Present for current and open-ended roles/projects", () => {
    const resume = {
      ...INITIAL_RESUME,
      experience: [
        {
          id: "role-1",
          employer: "Example Corp",
          jobTitle: "Engineer",
          location: "",
          startDate: "2022",
          endDate: "",
          currentRole: true,
          accomplishments: ["Maintained production services."],
        },
      ],
      projects: [
        {
          id: "project-1",
          name: "Open-source tool",
          subtitle: "",
          startDate: "2024",
          endDate: "Present",
          url: "",
          description: "",
          accomplishments: [],
        },
      ],
    };

    expect(
      validateAtsSafeV1(resume, DEFAULT_RESUME_SECTIONS).find(
        (finding) => finding.ruleId === "dates",
      ),
    ).toMatchObject({ severity: "pass" });
  });
});
