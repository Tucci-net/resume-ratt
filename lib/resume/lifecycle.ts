import type {
  CareerLibraryItem,
  CareerLibraryVariant,
  ResumeContent,
  ResumeLibraryReference,
  ResumeSnapshot,
  ResumeSnapshotSource,
} from "@/lib/resume/model";
import type { ResumeDraft } from "@/lib/resume/persistence";

export type StaleResumeReference = {
  reference: ResumeLibraryReference;
  item: CareerLibraryItem | null;
  sourceRevisionId: string;
  currentRevisionId: string | null;
};

export function getStaleResumeReferences(
  resume: ResumeContent,
  items: CareerLibraryItem[],
): StaleResumeReference[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return resume.careerLibraryReferences.flatMap((reference) => {
    const item = itemsById.get(reference.libraryItemId) ?? null;
    const sourceRevisionId =
      reference.canonicalRevisionId ??
      reference.libraryItemUpdatedAt ??
      "revision-unknown";
    const currentRevisionId = item
      ? (item.canonicalRevisionId ?? item.updatedAt)
      : null;
    return !item || sourceRevisionId !== currentRevisionId
      ? [{ reference, item, sourceRevisionId, currentRevisionId }]
      : [];
  });
}

export function updateDraftPresentationReferences(
  previous: ResumeContent,
  updated: ResumeContent,
): ResumeContent {
  const references = updated.careerLibraryReferences.map((reference) => {
    const resumeText = getPresentationText(previous, updated, reference);
    return resumeText === reference.resumeText
      ? reference
      : { ...reference, resumeText, variantId: undefined };
  });
  return { ...updated, careerLibraryReferences: references };
}

export function proposeCareerLibraryVariant(
  item: CareerLibraryItem,
  text: string,
  sourceDraftId: string,
  now = new Date().toISOString(),
  id = createId(),
): { item: CareerLibraryItem; variant: CareerLibraryVariant } {
  const normalized = text.trim();
  if (!normalized) throw new Error("A proposed wording variant cannot be empty.");
  if (normalized === item.canonicalText.trim()) {
    throw new Error("This wording already matches the canonical career evidence.");
  }
  const existing = item.variants?.find(
    (variant) => variant.text.trim() === normalized && variant.status !== "rejected",
  );
  if (existing) {
    throw new Error("This wording variant has already been proposed.");
  }
  const variant: CareerLibraryVariant = {
    id,
    text: normalized,
    status: "proposed",
    sourceDraftId,
    createdAt: now,
  };
  return {
    item: {
      ...item,
      canonicalRevisionId:
        item.canonicalRevisionId ?? item.updatedAt,
      variants: [...(item.variants ?? []), variant],
      updatedAt: now,
    },
    variant,
  };
}

export function createResumeSnapshot(
  draft: ResumeDraft,
  items: CareerLibraryItem[],
  targetApplicationId: string,
  submittedAt = new Date().toISOString(),
  id = createId(),
): ResumeSnapshot {
  const target = targetApplicationId.trim();
  if (!target) throw new Error("Enter a target job or application ID before submitting.");

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const sources: ResumeSnapshotSource[] = [];
  const seen = new Set<string>();
  for (const reference of draft.resume.careerLibraryReferences) {
    if (seen.has(reference.libraryItemId)) continue;
    seen.add(reference.libraryItemId);
    const item = itemsById.get(reference.libraryItemId);
    const currentRevisionId = item
      ? (item.canonicalRevisionId ?? item.updatedAt)
      : null;
    const sourceRevisionId =
      reference.canonicalRevisionId ??
      reference.libraryItemUpdatedAt ??
      currentRevisionId ??
      "revision-unknown";
    sources.push({
      libraryItemId: reference.libraryItemId,
      evidenceIds: [...(reference.evidenceIds ?? [])],
      ...(reference.variantId ? { variantId: reference.variantId } : {}),
      canonicalRevisionId: sourceRevisionId,
      canonicalTextAtSubmission:
        currentRevisionId === sourceRevisionId
          ? item?.canonicalText ?? reference.resumeText
          : (reference.canonicalTextAtLink ?? item?.canonicalText ?? reference.resumeText),
    });
  }

  return deepFreeze(
    structuredClone({
      id,
      draftId: draft.id,
      draftName: draft.name,
      targetApplicationId: target,
      submittedAt,
      content: draft.resume,
      design: draft.design,
      sections: draft.sections,
      sources,
    }),
  );
}

function getPresentationText(
  previous: ResumeContent,
  updated: ResumeContent,
  reference: ResumeLibraryReference,
): string {
  switch (reference.section) {
    case "summary":
      return extractEditedReferenceText(
        previous.summary,
        updated.summary,
        reference.resumeText,
      );
    case "skills":
      return extractEditedReferenceText(
        previous.skills,
        updated.skills,
        reference.resumeText,
      );
    case "experience": {
      const currentEntry = updated.experience.find(
        (entry) => entry.id === reference.libraryItemId,
      );
      if (currentEntry) {
        return [
          [currentEntry.jobTitle, currentEntry.employer]
            .map((value) => value.trim())
            .filter(Boolean)
            .join(" — "),
          ...currentEntry.accomplishments.map((line) => line.trim()),
        ]
          .filter(Boolean)
          .join("\n");
      }
      if (reference.type === "accomplishment") {
        const oldIndex = previous.experience.findIndex((entry) =>
          entry.accomplishments.includes(reference.resumeText),
        );
        if (oldIndex >= 0) {
          const oldEntry = previous.experience[oldIndex]!;
          const bulletIndex = oldEntry.accomplishments.indexOf(reference.resumeText);
          return (
            updated.experience[oldIndex]?.accomplishments[bulletIndex] ??
            reference.resumeText
          );
        }
      }
      return reference.resumeText;
    }
    case "education":
      return serializeEntry(
        updated.education.find((entry) => entry.id === reference.libraryItemId),
        (entry) => [entry.institution, entry.degree, entry.fieldOfStudy],
      );
    case "projects":
      return serializeEntry(
        updated.projects.find((entry) => entry.id === reference.libraryItemId),
        (entry) => [entry.name, entry.subtitle, entry.description],
      );
    case "certifications":
      return serializeEntry(
        updated.certifications.find((entry) => entry.id === reference.libraryItemId),
        (entry) => [entry.name, entry.issuer],
      );
  }
}

function extractEditedReferenceText(
  previousText: string,
  updatedText: string,
  referenceText: string,
): string {
  if (previousText === referenceText) return updatedText;
  const start = previousText.indexOf(referenceText);
  if (start < 0) return referenceText;
  const prefix = previousText.slice(0, start);
  const suffix = previousText.slice(start + referenceText.length);
  if (
    updatedText.startsWith(prefix) &&
    updatedText.endsWith(suffix) &&
    updatedText.length >= prefix.length + suffix.length
  ) {
    return updatedText.slice(prefix.length, updatedText.length - suffix.length);
  }
  return referenceText;
}

function serializeEntry<T>(
  entry: T | undefined,
  values: (entry: T) => string[],
): string {
  return entry
    ? values(entry)
        .map((value) => value.trim())
        .filter(Boolean)
        .join("\n")
    : "";
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `resume-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
