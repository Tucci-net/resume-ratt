import type {
  CareerLibraryItem,
  CareerLibraryItemType,
  ResumeContent,
  ResumeLibraryReference,
} from "@/lib/resume/model";
import { splitResumeItems } from "./format";

export function syncResumeContentToCareerLibrary(
  previousResume: ResumeContent,
  resume: ResumeContent,
  items: CareerLibraryItem[],
  draftId: string,
  now = new Date().toISOString(),
): { resume: ResumeContent; items: CareerLibraryItem[] } {
  const nextItems = [...items];
  const references: ResumeLibraryReference[] = [];
  const projections: Array<{
    id: string;
    type: CareerLibraryItemType;
    section: ResumeLibraryReference["section"];
    text: string;
  }> = [];

  if (resume.summary.trim()) {
    projections.push({
      id: `${draftId}:summary`,
      type: "summary",
      section: "summary",
      text: resume.summary.trim(),
    });
  }

  for (const entry of resume.experience) {
    const text = [
      [entry.jobTitle.trim(), entry.employer.trim()].filter(Boolean).join(" — "),
      entry.location.trim() && `Location: ${entry.location.trim()}`,
      entry.startDate.trim() &&
        `${entry.startDate.trim()} – ${entry.currentRole ? "Present" : entry.endDate.trim()}`,
      ...entry.accomplishments.map((accomplishment) => `- ${accomplishment.trim()}`),
    ]
      .filter(Boolean)
      .join("\n");
    if (text.trim()) {
      projections.push({
        id: entry.id,
        type: "experience",
        section: "experience",
        text,
      });
    }
  }
  for (const entry of resume.education) {
    const text = [
      entry.institution.trim(),
      [entry.degree.trim(), entry.fieldOfStudy.trim()].filter(Boolean).join(", "),
      entry.location.trim(),
      entry.startDate.trim() &&
        `${entry.startDate.trim()} – ${entry.currentlyEnrolled ? "Present" : entry.endDate.trim()}`,
      entry.gpa.trim() && `GPA: ${entry.gpa.trim()}`,
      entry.honors.trim(),
    ]
      .filter(Boolean)
      .join("\n");
    if (text.trim()) {
      projections.push({
        id: entry.id,
        type: "education",
        section: "education",
        text,
      });
    }
  }
  for (const entry of resume.projects) {
    const text = [
      entry.name.trim(),
      entry.subtitle.trim(),
      entry.startDate.trim() &&
        `${entry.startDate.trim()} – ${entry.endDate.trim()}`,
      entry.url.trim(),
      entry.description.trim(),
      ...entry.accomplishments.map((accomplishment) => `- ${accomplishment.trim()}`),
    ]
      .filter(Boolean)
      .join("\n");
    if (text.trim()) {
      projections.push({
        id: entry.id,
        type: "project",
        section: "projects",
        text,
      });
    }
  }
  if (resume.skills.trim()) {
    projections.push({
      id: `${draftId}:skills`,
      type: "skill",
      section: "skills",
      text: resume.skills.trim(),
    });
  }
  for (const entry of resume.certifications) {
    const text = [
      entry.name.trim(),
      entry.issuer.trim(),
      entry.issueDate.trim() &&
        `${entry.issueDate.trim()} – ${entry.expirationDate.trim()}`,
      entry.credentialId.trim(),
      entry.credentialUrl.trim(),
    ]
      .filter(Boolean)
      .join("\n");
    if (text.trim()) {
      projections.push({
        id: entry.id,
        type: "certification",
        section: "certifications",
        text,
      });
    }
  }

  for (const projection of projections) {
    const currentIndex = nextItems.findIndex(
      (item) => item.id === projection.id,
    );
    const current = currentIndex < 0 ? undefined : nextItems[currentIndex];
    if (
      !current ||
      current.type !== projection.type ||
      current.canonicalText !== projection.text
    ) {
      const item: CareerLibraryItem = {
        id: projection.id,
        type: projection.type,
        canonicalText: projection.text,
        tags: current?.tags ?? [],
        skills: current?.skills ?? [],
        metrics: current?.metrics ?? [],
        ...(current?.source ? { source: current.source } : {}),
        verificationStatus: current?.verificationStatus ?? "unverified",
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      if (currentIndex < 0) nextItems.push(item);
      else nextItems[currentIndex] = item;
    }

    references.push({
      libraryItemId: projection.id,
      type: projection.type,
      section: projection.section,
      relationship: "reference",
      resumeText: projection.text,
      libraryItemUpdatedAt:
        nextItems.find((item) => item.id === projection.id)?.updatedAt ?? now,
    });
  }

  const previousReferenceIds = new Set(
    previousResume.careerLibraryReferences.map(
      (reference) => reference.libraryItemId,
    ),
  );
  const nextReferenceIds = new Set(references.map((reference) => reference.libraryItemId));
  const previousEntityIds = new Set([
    ...previousResume.experience.map((entry) => entry.id),
    ...previousResume.education.map((entry) => entry.id),
    ...previousResume.projects.map((entry) => entry.id),
    ...previousResume.certifications.map((entry) => entry.id),
  ]);
  const currentEntityIds = new Set([
    ...resume.experience.map((entry) => entry.id),
    ...resume.education.map((entry) => entry.id),
    ...resume.projects.map((entry) => entry.id),
    ...resume.certifications.map((entry) => entry.id),
  ]);
  const preserve = resume.careerLibraryReferences.filter(
    (reference) =>
      previousReferenceIds.has(reference.libraryItemId) &&
      !nextReferenceIds.has(reference.libraryItemId) &&
      (!previousEntityIds.has(reference.libraryItemId) ||
        currentEntityIds.has(reference.libraryItemId)) &&
      !(
        reference.libraryItemId === `${draftId}:summary` &&
        !resume.summary.trim()
      ) &&
      !(
        reference.libraryItemId === `${draftId}:skills` &&
        !resume.skills.trim()
      ),
  );

  return {
    resume: {
      ...resume,
      careerLibraryReferences: [...references, ...preserve],
    },
    items: nextItems,
  };
}

export function syncReferencedResume(
  resume: ResumeContent,
  previous: CareerLibraryItem,
  updatedItem: CareerLibraryItem,
): ResumeContent {
  const updated: ResumeContent = { ...resume };
  const previousReferences = resume.careerLibraryReferences.filter(
    (reference) =>
      reference.libraryItemId === previous.id &&
      reference.relationship === "reference",
  );
  if (previousReferences.length === 0) return resume;

  const oldText = previous.canonicalText;
  const newText = updatedItem.canonicalText;
  updated.careerLibraryReferences = resume.careerLibraryReferences.map(
    (reference) =>
      reference.libraryItemId === updatedItem.id &&
      reference.relationship === "reference"
        ? {
            ...reference,
            type: updatedItem.type,
            section: getTargetSection(updatedItem.type),
            resumeText: newText,
            libraryItemUpdatedAt: updatedItem.updatedAt,
          }
        : reference,
  );

  switch (previous.type) {
    case "summary":
      updated.summary = updated.summary.includes(oldText)
        ? updated.summary.replace(oldText, newText)
        : updated.summary;
      break;
    case "experience":
      updated.experience = updated.experience.map((entry) =>
        entry.id === previous.id
          ? {
              ...entry,
              jobTitle: newText.split("\n")[0] ?? newText,
              accomplishments: newText.split("\n").slice(1),
            }
          : entry,
      );
      break;
    case "accomplishment":
      updated.experience = updated.experience.map((entry) => ({
        ...entry,
        accomplishments: entry.accomplishments.map((text) =>
          text === oldText ? newText : text,
        ),
      }));
      break;
    case "project":
      updated.projects = updated.projects.map((entry) =>
        entry.id === previous.id
          ? {
              ...entry,
              name: newText.split("\n")[0] ?? newText,
              description: newText.split("\n").slice(1).join("\n"),
            }
          : entry,
      );
      break;
    case "education":
      updated.education = updated.education.map((entry) =>
        entry.id === previous.id
          ? {
              ...entry,
              institution: newText.split("\n")[0] ?? newText,
              honors: newText.split("\n").slice(1).join("\n"),
            }
          : entry,
      );
      break;
    case "skill": {
      const skills = splitResumeItems(updated.skills);
      const oldSkills = splitResumeItems(oldText);
      const newSkills = splitResumeItems(newText);
      const replaced = skills.flatMap((skill) => {
        const index = oldSkills.findIndex(
          (oldSkill) => oldSkill.toLowerCase() === skill.toLowerCase(),
        );
        return index < 0 ? [skill] : [newSkills[index] ?? skill];
      });
      updated.skills = replaced.join(", ");
      break;
    }
    case "certification":
      updated.certifications = updated.certifications.map((entry) =>
        entry.id === previous.id
          ? { ...entry, name: newText.split("\n")[0] ?? newText }
          : entry,
      );
      break;
  }
  return updated;
}

function getTargetSection(
  type: CareerLibraryItemType,
): ResumeLibraryReference["section"] {
  switch (type) {
    case "accomplishment":
    case "experience":
      return "experience";
    case "project":
      return "projects";
    case "skill":
      return "skills";
    case "summary":
      return "summary";
    case "education":
      return "education";
    case "certification":
      return "certifications";
  }
}
