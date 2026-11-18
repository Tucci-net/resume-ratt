import { describe, expect, it } from "vitest";
import { syncResumeContentToCareerLibrary } from "../lib/resume/library-sync";
import { INITIAL_RESUME } from "../lib/resume/model";

describe("résumé and Career Library synchronization", () => {
  it("creates Career Library records and draft references from résumé edits", () => {
    const resume = {
      ...INITIAL_RESUME,
      experience: [
        {
          id: "role-1",
          employer: "Example Co",
          jobTitle: "Engineer",
          location: "",
          startDate: "2022",
          endDate: "",
          currentRole: true,
          accomplishments: ["Improved reliability"],
        },
      ],
    };

    const result = syncResumeContentToCareerLibrary(
      INITIAL_RESUME,
      resume,
      [],
      "draft-1",
      "2026-04-05T06:07:08.000Z",
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "role-1",
      type: "experience",
      canonicalText: expect.stringContaining("Improved reliability"),
    });
    expect(result.resume.careerLibraryReferences).toEqual([
      expect.objectContaining({
        libraryItemId: "role-1",
        section: "experience",
        libraryItemUpdatedAt: "2026-04-05T06:07:08.000Z",
      }),
    ]);
  });

  it("updates a shared canonical record and drops references to removed entries", () => {
    const role = {
      id: "role-1",
      employer: "Example Co",
      jobTitle: "Engineer",
      location: "",
      startDate: "",
      endDate: "",
      currentRole: false,
      accomplishments: [],
    };
    const previous = {
      ...INITIAL_RESUME,
      experience: [role],
      careerLibraryReferences: [
        {
          libraryItemId: role.id,
          type: "experience" as const,
          section: "experience" as const,
          relationship: "reference" as const,
          resumeText: "Engineer — Example Co",
          libraryItemUpdatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const changed = syncResumeContentToCareerLibrary(
      previous,
      { ...previous, experience: [{ ...role, jobTitle: "Staff Engineer" }] },
      [
        {
          id: role.id,
          type: "experience",
          canonicalText: "Engineer — Example Co",
          tags: [],
          skills: [],
          metrics: [],
          verificationStatus: "unverified",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      "draft-1",
      "2026-04-05T06:07:08.000Z",
    );

    expect(changed.items[0]?.canonicalText).toContain("Staff Engineer");
    const removed = syncResumeContentToCareerLibrary(
      previous,
      { ...previous, experience: [] },
      changed.items,
      "draft-1",
    );
    expect(removed.resume.careerLibraryReferences).toEqual([]);
    expect(removed.items).toHaveLength(1);
  });
});
