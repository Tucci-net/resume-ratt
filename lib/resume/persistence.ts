import { z } from "zod";
import {
  DEFAULT_RESUME_DESIGN,
  DEFAULT_RESUME_SECTIONS,
  INITIAL_RESUME,
} from "./model";
import type {
  CareerLibraryItemType,
  ResumeContent,
  ResumeDesignSettings,
  ResumeSnapshot,
  ResumeSectionConfig,
  ResumeSectionId,
} from "./model";

export const RESUME_DRAFT_STORAGE_KEY = "resume-ratt:drafts";
export const RESUME_DRAFT_STORE_VERSION = 3;

const sectionIds = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
] as const satisfies readonly ResumeSectionId[];
const libraryItemTypes = [
  "accomplishment",
  "experience",
  "project",
  "skill",
  "summary",
  "education",
  "certification",
] as const satisfies readonly CareerLibraryItemType[];

const experienceSchema = z.object({
  id: z.string().min(1),
  employer: z.string(),
  jobTitle: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  currentRole: z.boolean(),
  accomplishments: z.array(z.string()),
});
const educationSchema = z.object({
  id: z.string().min(1),
  institution: z.string(),
  degree: z.string(),
  fieldOfStudy: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  currentlyEnrolled: z.boolean(),
  gpa: z.string(),
  honors: z.string(),
});
const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  subtitle: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  url: z.string(),
  description: z.string(),
  accomplishments: z.array(z.string()),
});
const certificationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  issuer: z.string(),
  issueDate: z.string(),
  expirationDate: z.string(),
  credentialId: z.string(),
  credentialUrl: z.string(),
});
const resumeReferenceSchema = z.object({
  libraryItemId: z.string().min(1),
  type: z.enum(libraryItemTypes),
  section: z.enum(sectionIds),
  relationship: z.enum(["copy", "reference"]),
  resumeText: z.string(),
  libraryItemUpdatedAt: z.string().datetime().optional(),
  canonicalRevisionId: z.string().min(1).optional(),
  canonicalTextAtLink: z.string().optional(),
  evidenceIds: z.array(z.string()).optional(),
  variantId: z.string().optional(),
});
const resumeSchema = z.object({
  name: z.string(),
  headline: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  website: z.string(),
  summary: z.string(),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  projects: z.array(projectSchema),
  skills: z.string(),
  certifications: z.array(certificationSchema),
  careerLibraryReferences: z.array(resumeReferenceSchema),
});
const designSchema = z.object({
  fontFamily: z.string().min(1),
  bodyFontSize: z.number().min(9).max(12),
  headingScale: z.number().min(1.6).max(2.4),
  lineHeight: z.number().min(1.25).max(1.65),
  sectionSpacing: z.number().min(10).max(30),
});
const sectionSchema = z.object({
  id: z.enum(sectionIds),
  visible: z.boolean(),
});
const sectionsSchema = z.array(sectionSchema).length(sectionIds.length);
const snapshotSourceSchema = z.object({
  libraryItemId: z.string().min(1),
  evidenceIds: z.array(z.string()),
  variantId: z.string().optional(),
  canonicalRevisionId: z.string().min(1),
  canonicalTextAtSubmission: z.string(),
});
const snapshotSchema = z.object({
  id: z.string().min(1),
  draftId: z.string().min(1),
  draftName: z.string(),
  targetApplicationId: z.string().trim().min(1),
  submittedAt: z.string().datetime(),
  content: resumeSchema,
  design: designSchema,
  sections: sectionsSchema,
  sources: z.array(snapshotSourceSchema),
});
const draftSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  updatedAt: z.string().datetime(),
  resume: resumeSchema,
  design: designSchema,
  sections: sectionsSchema,
});
const draftStoreV2Schema = z.object({
  version: z.literal(2),
  activeDraftId: z.string().min(1),
  drafts: z.array(draftSchema).min(1),
});
const draftStoreV3Schema = z.object({
  version: z.literal(3),
  activeDraftId: z.string().min(1),
  drafts: z.array(draftSchema).min(1),
  snapshots: z.array(snapshotSchema),
});
const draftStoreV1Schema = z.object({
  version: z.literal(1),
  activeDraftId: z.string().min(1),
  drafts: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(100),
        updatedAt: z.string().datetime(),
        resume: resumeSchema.omit({ careerLibraryReferences: true }),
        design: designSchema,
        sections: sectionsSchema,
      }),
    )
    .min(1),
});

export type ResumeDraft = {
  id: string;
  name: string;
  updatedAt: string;
  resume: ResumeContent;
  design: ResumeDesignSettings;
  sections: ResumeSectionConfig[];
};

export type ResumeDraftStore = {
  version: typeof RESUME_DRAFT_STORE_VERSION;
  activeDraftId: string;
  drafts: ResumeDraft[];
  snapshots: ReadonlyArray<ResumeSnapshot>;
};

export type ParsedResumeDraftStore = {
  store: ResumeDraftStore;
  migrated: boolean;
  warnings: string[];
};

export function createResumeDraft(
  name = "Untitled resume",
  id = createId(),
  now = new Date().toISOString(),
): ResumeDraft {
  return {
    id,
    name,
    updatedAt: now,
    resume: structuredClone(INITIAL_RESUME),
    design: { ...DEFAULT_RESUME_DESIGN },
    sections: DEFAULT_RESUME_SECTIONS.map((section) => ({ ...section })),
  };
}

export function createInitialResumeDraftStore(): ResumeDraftStore {
  const draft = createResumeDraft(
    "My Resume",
    "default-resume",
    "1970-01-01T00:00:00.000Z",
  );
  return {
    version: RESUME_DRAFT_STORE_VERSION,
    activeDraftId: draft.id,
    drafts: [draft],
    snapshots: [],
  };
}

export function parseResumeDraftStore(raw: string): ParsedResumeDraftStore {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Saved drafts are not valid JSON. Original data was preserved.");
  }

  const version =
    typeof value === "object" && value !== null && "version" in value
      ? value.version
      : undefined;

  if (version === 1) {
    const parsed = draftStoreV1Schema.safeParse(value);
    if (!parsed.success) {
      throw new Error(
        `Saved drafts could not be migrated: ${parsed.error.issues[0]?.message ?? "invalid version 1 data"}. Original data was preserved.`,
      );
    }

    const warnings: string[] = [];
    const drafts = parsed.data.drafts.map((draft) =>
      normalizeDraft(
        {
          ...draft,
          resume: {
            ...draft.resume,
            careerLibraryReferences: [],
          },
        },
        warnings,
      ),
    );
    const store = makeStore(parsed.data.activeDraftId, drafts, []);
    return { store, migrated: true, warnings };
  }

  if (version === 2) {
    const parsed = draftStoreV2Schema.safeParse(value);
    if (!parsed.success) {
      throw new Error(
        `Saved drafts could not be migrated: ${parsed.error.issues[0]?.message ?? "invalid version 2 data"}. Original data was preserved.`,
      );
    }

    const warnings: string[] = [];
    const drafts = parsed.data.drafts.map((draft) =>
      normalizeDraft(draft, warnings),
    );
    return {
      store: makeStore(parsed.data.activeDraftId, drafts, []),
      migrated: true,
      warnings,
    };
  }

  if (version !== RESUME_DRAFT_STORE_VERSION) {
    throw new Error(
      `Saved drafts use unsupported version "${String(version)}". Original data was preserved.`,
    );
  }

  const parsed = draftStoreV3Schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Saved drafts are malformed: ${parsed.error.issues[0]?.message ?? "invalid data"}. Original data was preserved.`,
    );
  }

  const warnings: string[] = [];
  const drafts = parsed.data.drafts.map((draft) =>
    normalizeDraft(draft, warnings),
  );
  return {
    store: makeStore(parsed.data.activeDraftId, drafts, parsed.data.snapshots),
    migrated: false,
    warnings,
  };
}

export function serializeResumeDraftStore(store: ResumeDraftStore): string {
  const normalized = {
    version: RESUME_DRAFT_STORE_VERSION,
    activeDraftId: store.activeDraftId,
    drafts: store.drafts,
    snapshots: [...store.snapshots],
  };
  const parsed = draftStoreV3Schema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(
      `Drafts could not be saved: ${parsed.error.issues[0]?.message ?? "invalid data"}.`,
    );
  }
  assertUniqueDraftIds(parsed.data.drafts);
  assertUniqueSnapshotIds(parsed.data.snapshots);
  if (!parsed.data.drafts.some((draft) => draft.id === parsed.data.activeDraftId)) {
    throw new Error("The active draft does not exist in the draft collection.");
  }
  return JSON.stringify(parsed.data);
}

export function safeDesignForPersistence(
  design: ResumeDesignSettings,
): ResumeDesignSettings {
  return {
    ...design,
    fontFamily: isBuiltInFont(design.fontFamily)
      ? design.fontFamily
      : DEFAULT_RESUME_DESIGN.fontFamily,
  };
}

function normalizeDraft(
  draft: z.infer<typeof draftSchema>,
  warnings: string[],
): ResumeDraft {
  const design = safeDesignForPersistence(draft.design);
  if (design.fontFamily !== draft.design.fontFamily) {
    warnings.push(
      `Draft "${draft.name}" used an uploaded or unavailable font. The preview uses Inter because font files are not stored in draft data.`,
    );
  }
  assertValidSections(draft.sections);
  return {
    ...draft,
    resume: draft.resume as ResumeContent,
    design,
    sections: draft.sections as ResumeSectionConfig[],
  };
}

function makeStore(
  activeDraftId: string,
  drafts: ResumeDraft[],
  snapshots: ReadonlyArray<ResumeSnapshot>,
): ResumeDraftStore {
  assertUniqueDraftIds(drafts);
  assertUniqueSnapshotIds(snapshots);
  const active = drafts.some((draft) => draft.id === activeDraftId)
    ? activeDraftId
    : drafts[0]!.id;
  return {
    version: RESUME_DRAFT_STORE_VERSION,
    activeDraftId: active,
    drafts,
    snapshots: snapshots.map((snapshot) => deepFreeze(structuredClone(snapshot))),
  };
}

function assertUniqueSnapshotIds(snapshots: ReadonlyArray<{ id: string }>): void {
  if (new Set(snapshots.map((snapshot) => snapshot.id)).size !== snapshots.length) {
    throw new Error("Submitted snapshots contain duplicate IDs.");
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function assertUniqueDraftIds(drafts: Array<{ id: string }>): void {
  if (new Set(drafts.map((draft) => draft.id)).size !== drafts.length) {
    throw new Error("Saved drafts contain duplicate IDs.");
  }
}

function assertValidSections(sections: Array<{ id: string }>): void {
  if (new Set(sections.map((section) => section.id)).size !== sectionIds.length) {
    throw new Error("A draft must have each resume section exactly once.");
  }
  if (sectionIds.some((id) => !sections.some((section) => section.id === id))) {
    throw new Error("A draft is missing a resume section.");
  }
}

function isBuiltInFont(fontFamily: string): boolean {
  return [
    "inter",
    "roboto",
    "open-sans",
    "source-sans-3",
    "lato",
    "merriweather",
    "libre-baskerville",
    "eb-garamond",
  ].includes(fontFamily);
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
