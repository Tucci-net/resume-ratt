import type {
  ResumeContent,
  ResumeDesignSettings,
  ResumeSectionConfig,
  ResumeSectionId,
} from "./model";
import {
  hasResumeSectionContent,
  RESUME_SECTION_LABELS,
} from "./sections";
import { splitResumeItems } from "./format";

export type ResumeExportSource = {
  name: string;
  revision?: number;
  updatedAt?: string;
  content: ResumeContent;
  design: ResumeDesignSettings;
  sections: ResumeSectionConfig[];
};

export function selectResumePresentation(
  content: ResumeContent,
  sections: ResumeSectionConfig[],
): ResumeContent {
  const visible = new Set(
    sections.filter((section) => section.visible).map((section) => section.id),
  );
  const presentation = structuredClone(content);
  if (!visible.has("summary")) presentation.summary = "";
  if (!visible.has("experience")) presentation.experience = [];
  if (!visible.has("education")) presentation.education = [];
  if (!visible.has("projects")) presentation.projects = [];
  if (!visible.has("skills")) presentation.skills = "";
  if (!visible.has("certifications")) presentation.certifications = [];
  presentation.experience = presentation.experience.filter((entry) =>
    hasResumeSectionContent(
      { ...presentation, experience: [entry] },
      "experience",
    ),
  );
  presentation.education = presentation.education.filter((entry) =>
    hasResumeSectionContent({ ...presentation, education: [entry] }, "education"),
  );
  presentation.projects = presentation.projects.filter((entry) =>
    hasResumeSectionContent({ ...presentation, projects: [entry] }, "projects"),
  );
  presentation.certifications = presentation.certifications.filter((entry) =>
    hasResumeSectionContent(
      { ...presentation, certifications: [entry] },
      "certifications",
    ),
  );
  return presentation;
}

export function serializeResumeMarkdown(source: ResumeExportSource): string {
  const content = selectResumePresentation(source.content, source.sections);
  const { sections } = source;
  const lines = [
    `# ${content.name.trim() || source.name}`,
    ...(content.headline.trim() ? [`Headline: ${content.headline.trim()}`] : []),
    ...(content.email.trim() ? [`Email: ${content.email.trim()}`] : []),
    ...(content.phone.trim() ? [`Phone: ${content.phone.trim()}`] : []),
    ...(content.location.trim() ? [`Location: ${content.location.trim()}`] : []),
    ...(content.website.trim()
      ? [`Website: ${markdownLink("Website", content.website)}`]
      : []),
  ];

  for (const section of sections) {
    if (
      !section.visible ||
      !hasResumeSectionContent(content, section.id)
    ) {
      continue;
    }

    lines.push("", `## ${RESUME_SECTION_LABELS[section.id]}`, "");
    lines.push(...serializeSection(content, section.id));
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function serializeResumePlainText(source: ResumeExportSource): string {
  return serializeResumeMarkdown(source)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
    .replace(/^- /gm, "* ");
}

export function serializeResumeJson(source: ResumeExportSource): string {
  const presentation = selectResumePresentation(source.content, source.sections);
  const content = Object.fromEntries(
    Object.entries(presentation).filter(
      ([key]) => key !== "careerLibraryReferences",
    ),
  );
  return JSON.stringify(
    {
      format: "resume-ratt-resume",
      version: 1,
      draft: {
        name: source.name,
        ...(source.revision === undefined
          ? {}
          : { revision: source.revision }),
        ...(source.updatedAt === undefined
          ? {}
          : { updatedAt: source.updatedAt }),
      },
      content,
      design: source.design,
      sections: source.sections,
    },
    null,
    2,
  );
}

export function createResumeExportFilename(
  name: string,
  extension: string,
): string {
  const safeName =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "resume";
  return `${safeName}.${extension}`;
}

function serializeSection(
  content: ResumeContent,
  sectionId: ResumeSectionId,
): string[] {
  switch (sectionId) {
    case "summary":
      return content.summary.trim().split("\n").map((line) => line.trimEnd());
    case "experience":
      return content.experience.flatMap((entry) => {
        const heading = join([entry.jobTitle, entry.employer], " — ");
        const dates = join(
          [entry.startDate, entry.currentRole ? "Present" : entry.endDate],
          " – ",
        );
        return [
          `### ${heading || "Experience"}`,
          ...optionalLine("Location", entry.location),
          ...optionalLine("Dates", dates),
          ...entry.accomplishments
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => `- ${item}`),
          "",
        ];
      });
    case "education":
      return content.education.flatMap((entry) => {
        const dates = join(
          [
            entry.startDate,
            entry.currentlyEnrolled
              ? entry.endDate
                ? `Expected ${entry.endDate}`
                : "Currently enrolled"
              : entry.endDate,
          ],
          " – ",
        );
        return [
          `### ${entry.institution.trim() || "Education"}`,
          ...optionalLine("Degree", entry.degree),
          ...optionalLine("Field", entry.fieldOfStudy),
          ...optionalLine("Location", entry.location),
          ...optionalLine("Dates", dates),
          ...optionalLine("GPA", entry.gpa),
          ...optionalLine("Honors", entry.honors),
          "",
        ];
      });
    case "projects":
      return content.projects.flatMap((entry) => {
        const heading = join([entry.name, entry.subtitle], " — ");
        return [
          `### ${heading || "Project"}`,
          ...optionalLine("Dates", join([entry.startDate, entry.endDate], " – ")),
          ...(entry.url.trim()
            ? [`URL: ${markdownLink(entry.url, entry.url)}`]
            : []),
          ...optionalLine("Description", entry.description),
          ...entry.accomplishments
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => `- ${item}`),
          "",
        ];
      });
    case "skills":
      return [splitResumeItems(content.skills).join(", ")];
    case "certifications":
      return content.certifications.flatMap((entry) => [
        `### ${entry.name.trim() || "Certification"}`,
        ...optionalLine("Issuer", entry.issuer),
        ...optionalLine("Issued", entry.issueDate),
        ...optionalLine(
          "Expires",
          entry.expirationDate,
        ),
        ...optionalLine("Credential ID", entry.credentialId),
        ...(entry.credentialUrl.trim()
          ? [`URL: ${markdownLink(entry.credentialUrl, entry.credentialUrl)}`]
          : []),
        "",
      ]);
  }
}

function markdownLink(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return label;
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `[${label}](${url.toString()})`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function optionalLine(label: string, value: string): string[] {
  const normalized = value.trim();
  return normalized ? [`${label}: ${normalized}`] : [];
}

function join(values: string[], separator: string): string {
  return values.map((value) => value.trim()).filter(Boolean).join(separator);
}
