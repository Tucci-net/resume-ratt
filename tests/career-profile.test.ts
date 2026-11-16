import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseCareerProfileMarkdown,
  serializeCareerProfileMarkdown,
} from "../lib/career-profile/format";
import { MarkdownCareerProfileRepository } from "../lib/career-profile/repository";
import { CareerProfileService } from "../lib/career-profile/service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("career profile format and repository", () => {
  it("parses Tanner profile data and round-trips the Markdown source", async () => {
    const markdown = await readFile(
      path.join(process.cwd(), "profiles", "profile-tanner.md"),
      "utf8",
    );
    const profile = parseCareerProfileMarkdown(markdown);

    expect(profile.profileId).toBe("profile-tanner");
    expect(profile.targetIdentity).toBe("Full-Stack Systems Engineer");
    expect(profile.locations.homeBase.postalCode).toBe("97212");
    expect(profile.skills.primary).toContain("Systems Integration");
    expect(profile.professionalDirection).toContain("continued operation");
    expect(parseCareerProfileMarkdown(serializeCareerProfileMarkdown(profile))).toEqual(profile);
  });

  it("loads and updates a different profile through the same generic service", async () => {
    const directory = await makeTemporaryDirectory();
    const initialMarkdown = `---
schemaVersion: 1
profileId: synthetic-platform-engineer
name: Riley Example
targetIdentity: Platform Engineer
preferredRoleFamilies:
  - platform-engineering
seedTitles:
  - Platform Engineer
locations:
  homeBase:
    city: Madison
    region: Wisconsin
    postalCode: "53703"
skills:
  primary:
    - Go
  secondary:
    - Kubernetes
compensation:
  currency: USD
  minimumAnnual: 120000
searchPreferences:
  allowGeneratedTerms: false
  requireApprovalForGeneratedTerms: true
  minimumCareerFit: 70
searchTerms:
  - id: platform-infra
    term: Platform Infrastructure Engineer
    source: taxonomy
    status: rejected
jobSources:
  - providerId: regional-board
    providerName: Regional Engineering Board
    enabled: false
    capabilities:
      - platform roles
    geographicRelevance: Midwest
    industryRelevance: Infrastructure software
    status: available
    recommendationReason: Focused regional engineering listings.
---

Build reliable developer platforms.
`;
    const filePath = path.join(directory, "synthetic-platform-engineer.md");
    await writeFile(filePath, initialMarkdown, "utf8");
    const repository = new MarkdownCareerProfileRepository(directory);
    const service = new CareerProfileService(repository);

    const loaded = await service.loadProfile("synthetic-platform-engineer");
    expect(loaded.profile.compensation.minimumAnnual).toBe(120_000);
    expect(loaded.profile.searchTerms[0]?.status).toBe("rejected");
    expect(loaded.profile.jobSources[0]?.providerName).toBe(
      "Regional Engineering Board",
    );
    const updatedProfile = service.validateProfile({
      ...loaded.profile,
      targetIdentity: "Senior Platform Engineer",
      searchTerms: [
        {
          id: "taxonomy-platform",
          term: "Platform Infrastructure Engineer",
          source: "taxonomy",
          status: "pending",
        },
      ],
    });
    const saved = await service.updateProfile(
      "synthetic-platform-engineer",
      updatedProfile,
      loaded.revision,
    );

    expect(saved.profile.targetIdentity).toBe("Senior Platform Engineer");
    expect(saved.profile.searchTerms[0]?.status).toBe("pending");
    expect(await repository.exportProfile("synthetic-platform-engineer")).toContain(
      "Build reliable developer platforms.",
    );
    expect(
      parseCareerProfileMarkdown(
        await readFile(filePath, "utf8"),
      ).targetIdentity,
    ).toBe("Senior Platform Engineer");
  });

  it("rejects invalid profiles and stale writes without replacing the source", async () => {
    const directory = await makeTemporaryDirectory();
    const initialMarkdown = `---
schemaVersion: 1
profileId: profile-conflict-test
name: Taylor Example
targetIdentity: Systems Engineer
preferredRoleFamilies: []
seedTitles: []
locations:
  homeBase:
    city: Salem
    region: Oregon
    postalCode: "97301"
skills:
  primary: []
  secondary: []
compensation: {}
searchPreferences:
  allowGeneratedTerms: true
  requireApprovalForGeneratedTerms: true
  minimumCareerFit: 50
searchTerms: []
jobSources: []
---

Original direction.
`;
    const filePath = path.join(directory, "profile-conflict-test.md");
    await writeFile(filePath, initialMarkdown, "utf8");
    const service = new CareerProfileService(
      new MarkdownCareerProfileRepository(directory),
    );
    const loaded = await service.loadProfile("profile-conflict-test");

    expect(() =>
      service.validateProfile({
        ...loaded.profile,
        compensation: { minimumAnnual: 150_000, maximumAnnual: 100_000 },
      }),
    ).toThrow(/Maximum annual compensation/);

    await writeFile(filePath, initialMarkdown.replace("Original direction.", "External edit."), "utf8");
    await expect(
      service.updateProfile(
        "profile-conflict-test",
        loaded.profile,
        loaded.revision,
      ),
    ).rejects.toThrow(/changed since it was loaded/);
    expect(await readFile(filePath, "utf8")).toContain("External edit.");
  });
});

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "resume-ratt-career-profile-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}
