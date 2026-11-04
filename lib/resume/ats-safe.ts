import type {
  ResumeContent,
  ResumeSectionConfig,
  ResumeSectionId,
} from "./model";
import { RESUME_SECTION_LABELS, hasResumeSectionContent } from "./sections";
import { splitResumeItems } from "./format";

export const ATS_SAFE_V1_CONTRACT = {
  version: "ats-safe-v1",
  columns: 1,
  semanticReadingOrder: true,
  selectableText: true,
  contactDetailsInMainFlow: true,
  bullets: "unicode-text-bullets",
  sectionLabels: RESUME_SECTION_LABELS,
  prohibited: [
    "tables",
    "text-boxes",
    "image-based-text",
    "skill-bars",
    "icon-only-information",
  ],
} as const;

export type AtsFindingSeverity = "pass" | "warning" | "error";

export type AtsFinding = {
  ruleId: string;
  severity: AtsFindingSeverity;
  message: string;
  path?: string;
};

const DATE_PATTERN =
  /^(?:\d{4}|(?:\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|(?:0[1-9]|1[0-2])\/\d{4})$/i;
const YEAR_PATTERN = /^\d{4}$/;

export function generateAtsPlainText(
  resume: ResumeContent,
  sections: ResumeSectionConfig[],
): string {
  const lines: string[] = [];
  const name = resume.name.trim();
  const headline = resume.headline.trim();
  if (name) lines.push(name);
  if (headline) lines.push(headline);

  const contactDetails = [
    resume.email,
    resume.phone,
    resume.location,
    resume.website,
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  lines.push(...contactDetails);

  for (const section of sections) {
    if (!section.visible || !hasResumeSectionContent(resume, section.id)) {
      continue;
    }

    const content = getSectionPlainText(resume, section.id);
    if (content) {
      lines.push("", RESUME_SECTION_LABELS[section.id], content);
    }
  }

  return lines.join("\n").trim();
}

export function validateAtsSafeV1(
  resume: ResumeContent,
  sections: ResumeSectionConfig[],
  options: {
    headingLabels?: Partial<Record<ResumeSectionId, string>>;
  } = {},
): AtsFinding[] {
  const findings: AtsFinding[] = [];

  findings.push(
    resume.name.trim()
      ? {
          ruleId: "contact-name",
          severity: "pass",
          message: "A name is present in the document header.",
          path: "name",
        }
      : {
          ruleId: "contact-name",
          severity: "error",
          message: "Add a name so the resume can be identified.",
          path: "name",
        },
  );
  for (const field of ["email", "phone"] as const) {
    findings.push(
      resume[field].trim()
        ? {
            ruleId: "contact-field",
            severity: "pass",
            message: `${field === "email" ? "Email" : "Phone"} contact information is present.`,
            path: field,
          }
        : {
            ruleId: "contact-field",
            severity: "warning",
            message: `Add a ${field} address for a direct contact method.`,
            path: field,
          },
    );
  }

  const sectionIds = sections.map((section) => section.id);
  const hasDuplicates = new Set(sectionIds).size !== sectionIds.length;
  const hasUnknownSection = sectionIds.some(
    (id) => !Object.hasOwn(RESUME_SECTION_LABELS, id),
  );
  const missingSections = (
    Object.keys(RESUME_SECTION_LABELS) as ResumeSectionId[]
  ).filter((id) => !sectionIds.includes(id));
  findings.push(
    hasDuplicates || hasUnknownSection || missingSections.length > 0
      ? {
          ruleId: "reading-order",
          severity: "error",
          message:
            "Section order contains duplicates, unknown sections, or missing sections.",
          path: "sections",
        }
      : {
          ruleId: "reading-order",
          severity: "pass",
          message:
            "Sections have a single, explicit reading order; contact details remain before them.",
          path: "sections",
        },
  );

  for (const section of sections) {
    const configuredHeading =
      options.headingLabels?.[section.id] ??
      RESUME_SECTION_LABELS[section.id];
    if (!configuredHeading) {
      findings.push({
        ruleId: "section-heading",
        severity: "warning",
        message: "This section has no recognized canonical heading.",
        path: `sections.${section.id}`,
      });
      continue;
    }
    const canonicalHeading = RESUME_SECTION_LABELS[section.id];
    findings.push(
      normalizeHeading(configuredHeading) === normalizeHeading(canonicalHeading)
        ? {
            ruleId: "section-heading",
            severity: "pass",
            message: `"${configuredHeading}" is a recognized section heading.`,
            path: `sections.${section.id}`,
          }
        : {
            ruleId: "section-heading",
            severity: "warning",
            message: `"${configuredHeading}" is not a canonical v1 heading; use "${canonicalHeading}" for conventional parsing.`,
            path: `sections.${section.id}`,
          },
    );
  }

  const visibleEmptySections = sections.filter(
    (section) =>
      section.visible && !hasResumeSectionContent(resume, section.id),
  );
  findings.push(
    visibleEmptySections.length > 0
      ? {
          ruleId: "empty-sections",
          severity: "warning",
          message: `Visible sections without content are omitted: ${visibleEmptySections
            .map((section) => RESUME_SECTION_LABELS[section.id])
            .join(", ")}.`,
          path: "sections",
        }
      : {
          ruleId: "empty-sections",
          severity: "pass",
          message: "All visible sections contain content.",
          path: "sections",
        },
  );

  const hiddenWithContent = sections.filter(
    (section) =>
      !section.visible && hasResumeSectionContent(resume, section.id),
  );
  if (hiddenWithContent.length > 0) {
    findings.push({
      ruleId: "hidden-content",
      severity: "warning",
      message: `Content is excluded from the document in hidden sections: ${hiddenWithContent
        .map((section) => RESUME_SECTION_LABELS[section.id])
        .join(", ")}.`,
      path: "sections",
    });
  }

  const dateIssues = collectDateIssues(resume);
  findings.push(
    dateIssues.length > 0
      ? {
          ruleId: "dates",
          severity: "warning",
          message: dateIssues.join(" "),
          path: "dates",
        }
      : {
          ruleId: "dates",
          severity: "pass",
          message: "Provided dates use supported, consistent formats.",
          path: "dates",
        },
  );

  const links: Array<[string, string]> = [
    ["website", resume.website],
    ...resume.projects.map(
      (item, index): [string, string] => [`projects[${index}].url`, item.url],
    ),
    ...resume.certifications.map(
      (item, index): [string, string] => [
        `certifications[${index}].credentialUrl`,
        item.credentialUrl,
      ],
    ),
  ];
  const invalidLinks = links.filter(
    ([, value]) => value.trim() && !isAccessibleLink(value),
  );
  findings.push(
    invalidLinks.length > 0
      ? {
          ruleId: "links",
          severity: "warning",
          message: `Check these links; only valid HTTP(S) addresses are printable: ${invalidLinks
            .map(([path]) => path)
            .join(", ")}.`,
          path: "links",
        }
      : {
          ruleId: "links",
          severity: "pass",
          message: "Provided links use valid HTTP(S) addresses.",
          path: "links",
        },
  );

  return findings;
}

function getSectionPlainText(
  resume: ResumeContent,
  sectionId: ResumeSectionId,
): string {
  switch (sectionId) {
    case "summary":
      return resume.summary.trim();
    case "experience":
      return resume.experience
        .filter((item) =>
          hasResumeSectionContent({ ...resume, experience: [item] }, "experience"),
        )
        .map((item) => {
          const heading = join([item.jobTitle, item.employer], " | ");
          const dates = join(
            [item.startDate, item.currentRole ? "Present" : item.endDate],
            " - ",
          );
          return [
            join([heading, dates], " | "),
            item.location.trim(),
            ...item.accomplishments
              .map((bullet) => bullet.trim())
              .filter(Boolean)
              .map((bullet) => `• ${bullet}`),
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");
    case "education":
      return resume.education
        .filter((item) =>
          hasResumeSectionContent({ ...resume, education: [item] }, "education"),
        )
        .map((item) => {
          const dates = join(
            [
              item.startDate,
              item.currentlyEnrolled
                ? item.endDate
                  ? `Expected ${item.endDate}`
                  : "Currently enrolled"
                : item.endDate,
            ],
            " - ",
          );
          const details = join(
            [
              item.location,
              item.gpa ? `GPA ${item.gpa}` : "",
              item.honors,
            ],
            " | ",
          );
          return [
            join([item.institution, dates], " | "),
            join([item.degree, item.fieldOfStudy], ", "),
            details,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");
    case "projects":
      return resume.projects
        .filter((item) =>
          hasResumeSectionContent({ ...resume, projects: [item] }, "projects"),
        )
        .map((item) =>
          [
            join([item.name, item.subtitle], " | "),
            join([item.startDate, item.endDate], " - "),
            item.url.trim(),
            item.description.trim(),
            ...item.accomplishments
              .map((bullet) => bullet.trim())
              .filter(Boolean)
              .map((bullet) => `• ${bullet}`),
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n");
    case "skills":
      return splitResumeItems(resume.skills).join(", ");
    case "certifications":
      return resume.certifications
        .filter((item) =>
          hasResumeSectionContent(
            { ...resume, certifications: [item] },
            "certifications",
          ),
        )
        .map((item) =>
          [
            item.name.trim(),
            join(
              [
                item.issuer,
                item.issueDate,
                item.expirationDate ? `Expires ${item.expirationDate}` : "",
                item.credentialId ? `ID ${item.credentialId}` : "",
              ],
              " | ",
            ),
            item.credentialUrl.trim(),
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n");
  }
}

function collectDateIssues(resume: ResumeContent): string[] {
  const issues: string[] = [];
  const validateDate = (value: string, label: string) => {
    const normalized = value.trim().replace(/^Expected\s+/i, "");
    if (
      normalized &&
      !isPresent(normalized) &&
      !DATE_PATTERN.test(normalized)
    ) {
      issues.push(`${label} "${value}" is not a supported date format.`);
    }
  };
  const validateRange = (
    start: string,
    end: string,
    label: string,
    endMayBeOmitted = false,
    requireDates = false,
  ) => {
    const normalizedEnd = end.replace(/^Expected\s+/i, "");
    validateDate(start, `${label} start date`);
    validateDate(normalizedEnd, `${label} end date`);
    if (normalizedEnd && !start) {
      issues.push(`${label} has an end date but no start date.`);
    } else if (!start && !normalizedEnd && requireDates) {
      issues.push(`${label} is missing dates.`);
    } else if (start && !normalizedEnd && !endMayBeOmitted) {
      issues.push(`${label} has a start date but no end date or current status.`);
    } else if (
      start &&
      normalizedEnd &&
      !isPresent(normalizedEnd) &&
      datePrecision(start) !== datePrecision(normalizedEnd)
    ) {
      issues.push(`${label} uses inconsistent date precision.`);
    }
  };

  resume.experience.forEach((item, index) =>
    validateRange(
      item.startDate,
      item.currentRole ? "Present" : item.endDate,
      `Experience ${index + 1}`,
      item.currentRole,
      true,
    ),
  );
  resume.education.forEach((item, index) =>
    validateRange(
      item.startDate,
      item.currentlyEnrolled
        ? item.endDate
          ? `Expected ${item.endDate}`
          : ""
        : item.endDate,
      `Education ${index + 1}`,
      item.currentlyEnrolled,
      true,
    ),
  );
  resume.projects.forEach((item, index) =>
    validateRange(item.startDate, item.endDate, `Project ${index + 1}`, true),
  );
  resume.certifications.forEach((item, index) => {
    validateDate(item.issueDate, `Certification ${index + 1} issue date`);
    validateDate(item.expirationDate, `Certification ${index + 1} expiration date`);
    if (item.expirationDate && !item.issueDate) {
      issues.push(
        `Certification ${index + 1} has an expiration date but no issue date.`,
      );
    }
  });
  return issues;
}

function isAccessibleLink(value: string): boolean {
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(value.trim())
        ? value.trim()
        : `https://${value.trim()}`,
    );
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname.includes("."))
    );
  } catch {
    return false;
  }
}

function normalizeHeading(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isPresent(value: string): boolean {
  return /^present$/i.test(value.trim());
}

function datePrecision(value: string): "year" | "month" | "day" | "other" {
  const trimmed = value.trim();
  if (YEAR_PATTERN.test(trimmed)) return "year";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "day";
  if (
    /^\d{4}-\d{2}$/.test(trimmed) ||
    /^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}$/i.test(
      trimmed,
    ) ||
    /^\d{2}\/\d{4}$/.test(trimmed)
  ) {
    return "month";
  }
  return "other";
}

function join(values: string[], separator: string): string {
  return values.map((value) => value.trim()).filter(Boolean).join(separator);
}
