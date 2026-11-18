import { describe, expect, it } from "vitest";
import {
  createResumeSnapshot,
  getStaleResumeReferences,
  proposeCareerLibraryVariant,
  updateDraftPresentationReferences,
} from "../lib/resume/lifecycle";
import {
  createInitialResumeDraftStore,
  parseResumeDraftStore,
  serializeResumeDraftStore,
} from "../lib/resume/persistence";
import { INITIAL_RESUME } from "../lib/resume/model";
import type { CareerLibraryItem } from "../lib/resume/model";

const item: CareerLibraryItem = {
  id: "experience-1",
  type: "experience",
  canonicalText: "Engineer — Example Co",
  canonicalRevisionId: "revision-1",
  tags: [],
  skills: [],
  metrics: [],
  verificationStatus: "unverified",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Career Library and résumé lifecycle boundaries", () => {
  it("keeps draft wording edits local to the presentation snapshot", () => {
    const previous = {
      ...INITIAL_RESUME,
      experience: [
        {
          id: item.id,
          employer: "Example Co",
          jobTitle: "Engineer",
          location: "",
          startDate: "",
          endDate: "",
          currentRole: false,
          accomplishments: [],
        },
      ],
      careerLibraryReferences: [
        {
          libraryItemId: item.id,
          type: "experience" as const,
          section: "experience" as const,
          relationship: "reference" as const,
          resumeText: item.canonicalText,
          canonicalRevisionId: item.canonicalRevisionId,
          canonicalTextAtLink: item.canonicalText,
        },
      ],
    };
    const edited = updateDraftPresentationReferences(previous, {
      ...previous,
      experience: [
        { ...previous.experience[0]!, jobTitle: "Staff Engineer" },
      ],
    });

    expect(edited.experience[0]?.jobTitle).toBe("Staff Engineer");
    expect(edited.careerLibraryReferences[0]?.resumeText).toContain(
      "Staff Engineer",
    );
    expect(item.canonicalText).toBe("Engineer — Example Co");
    expect(item.canonicalRevisionId).toBe("revision-1");
  });

  it("flags a working draft when its linked canonical revision changes", () => {
    const resume = {
      ...INITIAL_RESUME,
      careerLibraryReferences: [
        {
          libraryItemId: item.id,
          type: item.type,
          section: "experience" as const,
          relationship: "reference" as const,
          resumeText: item.canonicalText,
          canonicalRevisionId: "revision-1",
        },
      ],
    };
    const changed = {
      ...item,
      canonicalText: "Staff Engineer — Example Co",
      canonicalRevisionId: "revision-2",
    };

    expect(getStaleResumeReferences(resume, [changed])).toHaveLength(1);
    expect(getStaleResumeReferences(resume, [item])).toEqual([]);
  });

  it("promotes draft wording only as a proposed variant, preserving canonical evidence", () => {
    const result = proposeCareerLibraryVariant(
      item,
      "Staff Engineer at Example Co",
      "draft-1",
      "2026-02-01T00:00:00.000Z",
      "variant-1",
    );

    expect(result.item.canonicalText).toBe(item.canonicalText);
    expect(result.item.canonicalRevisionId).toBe(item.canonicalRevisionId);
    expect(result.variant).toMatchObject({
      id: "variant-1",
      text: "Staff Engineer at Example Co",
      status: "proposed",
      sourceDraftId: "draft-1",
    });
  });

  it("freezes reproducible submitted snapshots independently of later edits", () => {
    const draft = createInitialResumeDraftStore().drafts[0]!;
    draft.resume.name = "Jordan Lee";
    draft.resume.experience = [
      {
        id: item.id,
        employer: "Example Co",
        jobTitle: "Engineer",
        location: "",
        startDate: "",
        endDate: "",
        currentRole: false,
        accomplishments: [],
      },
    ];
    draft.resume.careerLibraryReferences = [
      {
        libraryItemId: item.id,
        type: item.type,
        section: "experience",
        relationship: "reference",
        resumeText: item.canonicalText,
        canonicalRevisionId: "revision-1",
        canonicalTextAtLink: item.canonicalText,
        evidenceIds: ["evidence-1"],
      },
    ];

    const snapshot = createResumeSnapshot(
      draft,
      [item],
      "application-42",
      "2026-02-02T00:00:00.000Z",
      "snapshot-1",
    );
    draft.resume.name = "Changed after submission";
    const currentItem = {
      ...item,
      canonicalText: "Changed canonical evidence",
      canonicalRevisionId: "revision-2",
    };

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.content.experience)).toBe(true);
    expect(snapshot.content.name).toBe("Jordan Lee");
    expect(snapshot.sources[0]).toMatchObject({
      libraryItemId: item.id,
      evidenceIds: ["evidence-1"],
      canonicalRevisionId: "revision-1",
      canonicalTextAtSubmission: item.canonicalText,
    });
    expect(currentItem.canonicalText).not.toBe(
      snapshot.sources[0]?.canonicalTextAtSubmission,
    );

    const store = createInitialResumeDraftStore();
    const serialized = serializeResumeDraftStore({
      ...store,
      snapshots: [snapshot],
    });
    const restored = parseResumeDraftStore(serialized).store.snapshots[0]!;
    expect(restored.content.name).toBe("Jordan Lee");
    expect(restored.sources[0]?.canonicalTextAtSubmission).toBe(
      item.canonicalText,
    );
    expect(Object.isFrozen(restored.content)).toBe(true);
  });
});
