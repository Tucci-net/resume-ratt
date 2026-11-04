import type {
  ResumeContent,
  ResumeSectionConfig,
  ResumeSectionId,
} from "./model";
import { DEFAULT_RESUME_SECTIONS } from "./model";

export const RESUME_SECTION_LABELS: Record<ResumeSectionId, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
};

export function moveResumeSection(
  sections: ResumeSectionConfig[],
  sectionId: ResumeSectionId,
  direction: -1 | 1,
): ResumeSectionConfig[] {
  const index = sections.findIndex((section) => section.id === sectionId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= sections.length) {
    return sections;
  }

  const reordered = [...sections];
  [reordered[index], reordered[targetIndex]] = [
    reordered[targetIndex]!,
    reordered[index]!,
  ];
  return reordered;
}

export function setResumeSectionVisibility(
  sections: ResumeSectionConfig[],
  sectionId: ResumeSectionId,
  visible: boolean,
): ResumeSectionConfig[] {
  return sections.map((section) =>
    section.id === sectionId ? { ...section, visible } : section,
  );
}

export function resetResumeSectionOrder(
  sections: ResumeSectionConfig[],
): ResumeSectionConfig[] {
  const visibilityById = new Map(
    sections.map((section) => [section.id, section.visible]),
  );
  return DEFAULT_RESUME_SECTIONS.map((section) => ({
    ...section,
    visible: visibilityById.get(section.id) ?? section.visible,
  }));
}

function hasValue(...values: string[]): boolean {
  return values.some((value) => value.trim().length > 0);
}

export function hasResumeSectionContent(
  resume: ResumeContent,
  sectionId: ResumeSectionId,
): boolean {
  switch (sectionId) {
    case "summary":
      return hasValue(resume.summary);
    case "experience":
      return resume.experience.some(
        (item) =>
          hasValue(item.employer, item.jobTitle, item.location, item.startDate, item.endDate) ||
          item.accomplishments.some((bullet) => bullet.trim()),
      );
    case "education":
      return resume.education.some(
        (item) =>
          hasValue(
            item.institution,
            item.degree,
            item.fieldOfStudy,
            item.location,
            item.startDate,
            item.endDate,
            item.gpa,
            item.honors,
          ),
      );
    case "projects":
      return resume.projects.some(
        (item) =>
          hasValue(
            item.name,
            item.subtitle,
            item.startDate,
            item.endDate,
            item.url,
            item.description,
          ) || item.accomplishments.some((bullet) => bullet.trim()),
      );
    case "skills":
      return hasValue(resume.skills);
    case "certifications":
      return resume.certifications.some((item) =>
        hasValue(
          item.name,
          item.issuer,
          item.issueDate,
          item.expirationDate,
          item.credentialId,
          item.credentialUrl,
        ),
      );
  }
}

export function addResumeEntry<T extends { id: string }>(
  entries: T[],
  entry: T,
): T[] {
  return [...entries, entry];
}

export function removeResumeEntry<T extends { id: string }>(
  entries: T[],
  entryId: string,
): T[] {
  return entries.filter((entry) => entry.id !== entryId);
}
