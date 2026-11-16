import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { YamlRoleTaxonomyRepository } from "../lib/taxonomy/repository";
import { YamlProviderCatalogRepository } from "../lib/providers/repository";
import { MarkdownSearchPreferencesRepository } from "../lib/search-preferences/repository";
import { SearchPreferencesService } from "../lib/search-preferences/service";
import type { LegacySearchSettings } from "../lib/search-preferences/model";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("search intelligence foundation", () => {
  it("loads the versioned taxonomy and validates all cross-document references", async () => {
    const taxonomy = await new YamlRoleTaxonomyRepository().load();

    expect(taxonomy.taxonomyVersion).toBe("1.0.0");
    expect(taxonomy.families).toHaveLength(10);
    expect(taxonomy.titles).toContainEqual(
      expect.objectContaining({ id: "forward-deployed-engineer" }),
    );
    expect(taxonomy.skills).toContainEqual(
      expect.objectContaining({ id: "incident-response" }),
    );
  });

  it("loads only explicitly configured provider capabilities", async () => {
    const taxonomy = await new YamlRoleTaxonomyRepository().load();
    const catalog = await new YamlProviderCatalogRepository().load(taxonomy);

    expect(catalog.providers).toHaveLength(1);
    expect(catalog.providers[0]?.capabilities).toEqual([]);
    expect(catalog.providers[0]?.automationPolicy).toBe("manual-only");
  });

  it("rebuilds legacy settings in memory and persists decisions separately", async () => {
    const directory = await makeTemporaryDirectory();
    const repository = new MarkdownSearchPreferencesRepository(directory);
    const service = new SearchPreferencesService(repository, fixedClock);
    const legacy: LegacySearchSettings = {
      searchPreferences: {
        allowGeneratedTerms: false,
        requireApprovalForGeneratedTerms: true,
        minimumCareerFit: 70,
      },
      searchTerms: [
        {
          id: "legacy-term",
          term: "Platform Engineer",
          source: "taxonomy",
          status: "pending",
        },
      ],
      jobSources: [
        { providerId: "regional-board", enabled: false },
      ],
    };

    const initial = await service.loadPreferences("synthetic-profile", legacy);
    expect(initial.revision).toBeNull();
    expect(initial.preferences.terms[0]?.status).toBe("proposed");
    expect(initial.preferences.queryPlanning.allowTaxonomyExpansion).toBe(false);
    expect(await repository.loadPreferences("synthetic-profile")).toBeNull();

    const saved = await service.savePreferences(
      "synthetic-profile",
      {
        ...initial.preferences,
        terms: [
          {
            id: "custom-platform-title",
            value: "Platform Systems Engineer",
            type: "title",
            status: "approved",
            source: "user",
            sourceReference: "user-created",
            triggeringInputs: ["Platform Engineer"],
            rationale: "Added by the user.",
            confidence: 1,
            roleFamilyIds: ["platform-engineering"],
            createdAt: fixedClock().toISOString(),
            updatedAt: fixedClock().toISOString(),
          },
        ],
      },
      initial.revision,
    );
    const reloaded = await service.loadPreferences("synthetic-profile", legacy);

    expect(saved.preferences.version).toBe(1);
    expect(reloaded.preferences.terms[0]?.value).toBe(
      "Platform Systems Engineer",
    );
    expect(reloaded.revision).toBe(saved.revision);
    expect(await repository.exportPreferences("synthetic-profile")).toContain(
      "Search decisions are stored separately",
    );
  });

  it("increments preference versions and rejects stale writes", async () => {
    const directory = await makeTemporaryDirectory();
    const service = new SearchPreferencesService(
      new MarkdownSearchPreferencesRepository(directory),
      fixedClock,
    );
    const initial = await service.loadPreferences("profile-conflict");
    const saved = await service.savePreferences(
      "profile-conflict",
      initial.preferences,
      initial.revision,
    );

    const updated = await service.savePreferences(
      "profile-conflict",
      saved.preferences,
      saved.revision,
    );
    expect(updated.preferences.version).toBe(2);
    await expect(
      service.savePreferences(
        "profile-conflict",
        initial.preferences,
        initial.revision,
      ),
    ).rejects.toThrow(/changed since they were loaded/);
  });
});

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "resume-ratt-search-preferences-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function fixedClock(): Date {
  return new Date("2026-01-02T03:04:05.000Z");
}
