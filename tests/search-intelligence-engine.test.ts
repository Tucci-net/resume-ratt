import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CareerProfileSchema } from "../lib/career-profile/model";
import { parseCareerProfileMarkdown } from "../lib/career-profile/format";
import {
  createDefaultSearchPreferences,
  SearchPreferencesSchema,
} from "../lib/search-preferences/model";
import {
  parseSearchPreferencesMarkdown,
  serializeSearchPreferencesMarkdown,
} from "../lib/search-preferences/format";
import { buildSearchProfile } from "../lib/search-intelligence/engine";
import { createSearchPlan } from "../lib/search-intelligence/query-planner";
import { recommendProviders } from "../lib/providers/recommendations";
import { ProviderCatalogSchema } from "../lib/providers/model";
import { YamlRoleTaxonomyRepository } from "../lib/taxonomy/repository";
import type { CareerProfile } from "../lib/career-profile/model";
import type { SearchPreferences } from "../lib/search-preferences/model";

const now = new Date("2026-03-04T05:06:07.000Z");

describe("generic search strategy composition", () => {
  it("supports an unrelated accountant profile without engineering fallbacks", async () => {
    const taxonomy = await new YamlRoleTaxonomyRepository().load();
    const accountant = makeCareerProfile({
      profileId: "profile-accountant",
      name: "Riley Example",
      targetIdentity: "Accountant / Financial Analyst",
      preferredRoleFamilies: [],
      seedTitles: ["Accountant", "Financial Analyst"],
      skills: {
        primary: ["Financial reporting", "Budget analysis"],
        secondary: ["Forecasting"],
      },
    });
    const preferences = createDefaultSearchPreferences(accountant.profileId);

    const searchProfile = buildSearchProfile(
      accountant,
      preferences,
      taxonomy,
      now,
    );

    expect(searchProfile.seedTitles.map((term) => term.value)).toEqual([
      "Accountant",
      "Financial Analyst",
    ]);
    expect(searchProfile.proposedTitles).toEqual([]);
    expect(searchProfile.userInput.targetIdentity).toBe(
      "Accountant / Financial Analyst",
    );
    expect(searchProfile.terms.some((term) => /tanner/i.test(term.value))).toBe(
      false,
    );
  });

  it("expands taxonomy aliases into explainable proposed titles without replacing seeds", async () => {
    const taxonomy = await new YamlRoleTaxonomyRepository().load();
    const careerProfile = makeCareerProfile({
      profileId: "profile-integration",
      targetIdentity: "Systems Integration Engineer",
      preferredRoleFamilies: ["systems-integration"],
      seedTitles: ["Integration Engineer", "System Integration Engineer"],
    });

    const searchProfile = buildSearchProfile(
      careerProfile,
      createDefaultSearchPreferences(careerProfile.profileId),
      taxonomy,
      now,
    );
    const canonicalProposal = searchProfile.proposedTitles.filter(
      (term) => term.value === "Systems Integration Engineer",
    );
    const adjacentTitle = searchProfile.proposedTitles.find(
      (term) => term.value === "Infrastructure Software Engineer",
    );

    expect(canonicalProposal).toHaveLength(1);
    expect(canonicalProposal[0]).toMatchObject({
      status: "proposed",
      source: "taxonomy",
      sourceReference: "taxonomy:title:systems-integration-engineer",
      triggeringInputs: expect.arrayContaining([
        "Integration Engineer",
        "System Integration Engineer",
      ]),
    });
    expect(adjacentTitle?.driftWarning).toContain("Adjacent role family");
    expect(searchProfile.seedTitles.map((term) => term.value)).toEqual([
      "Integration Engineer",
      "System Integration Engineer",
    ]);
  });

  it("keeps proposed, rejected, and deferred terms out of active plans", async () => {
    const taxonomy = await new YamlRoleTaxonomyRepository().load();
    const careerProfile = makeCareerProfile({
      profileId: "profile-decisions",
      targetIdentity: "Full-Stack Systems Engineer",
      preferredRoleFamilies: ["systems-integration"],
      seedTitles: ["Full-Stack Systems Engineer"],
    });
    const defaults = createDefaultSearchPreferences(careerProfile.profileId);
    const preferences = SearchPreferencesSchema.parse({
      ...defaults,
      terms: [
        makeStoredTerm({
          id: "rejected-seed-overwrite",
          value: "Full-Stack Systems Engineer",
          status: "rejected",
          roleFamilyIds: ["systems-integration"],
        }),
        makeStoredTerm({
          id: "rejected-integration-title",
          value: "Systems Integration Engineer",
          status: "rejected",
          roleFamilyIds: ["systems-integration"],
        }),
        makeStoredTerm({
          id: "deferred-platform-title",
          value: "Platform Engineer",
          status: "deferred",
          roleFamilyIds: ["platform-engineering"],
        }),
        makeStoredTerm({
          id: "approved-custom-title",
          value: "Custom Systems Role",
          status: "approved",
        }),
      ],
      negativeKeywords: ["commission-only"],
    });
    const searchProfile = buildSearchProfile(
      careerProfile,
      preferences,
      taxonomy,
      now,
    );
    const plan = createSearchPlan(searchProfile, now);
    const plannedTerms = plan.queries.flatMap((query) => query.terms);

    expect(searchProfile.seedTitles[0]?.value).toBe(
      "Full-Stack Systems Engineer",
    );
    expect(
      searchProfile.terms.find(
        (term) => term.value === "Full-Stack Systems Engineer",
      )?.status,
    ).toBe("seed");
    expect(searchProfile.rejectedTitles.map((term) => term.value)).toContain(
      "Systems Integration Engineer",
    );
    expect(searchProfile.deferredTitles.map((term) => term.value)).toContain(
      "Platform Engineer",
    );
    expect(plannedTerms).toContain("Custom Systems Role");
    expect(plannedTerms).not.toContain("Systems Integration Engineer");
    expect(plannedTerms).not.toContain("Platform Engineer");
    expect(plan.queries[0]?.excludedTerms).toContain("commission-only");
    expect(
      searchProfile.proposedTitles.some((term) => plannedTerms.includes(term.value)),
    ).toBe(false);
  });

  it("produces the same query plan for the same profile and timestamp", async () => {
    const taxonomy = await new YamlRoleTaxonomyRepository().load();
    const markdown = await readFile(
      path.join(process.cwd(), "profiles", "profile-tanner.md"),
      "utf8",
    );
    const careerProfile = parseCareerProfileMarkdown(markdown);
    const searchProfile = buildSearchProfile(
      careerProfile,
      createDefaultSearchPreferences(careerProfile.profileId),
      taxonomy,
      now,
    );

    expect(createSearchPlan(searchProfile, now)).toEqual(
      createSearchPlan(searchProfile, now),
    );
  });

  it("rebuilds the active query from persisted Markdown preferences", async () => {
    const taxonomy = await new YamlRoleTaxonomyRepository().load();
    const careerProfile = makeCareerProfile({
      profileId: "profile-preferences-roundtrip",
      seedTitles: ["Accountant"],
    });
    const defaults = createDefaultSearchPreferences(careerProfile.profileId);
    const preferences = SearchPreferencesSchema.parse({
      ...defaults,
      terms: [
        makeStoredTerm({
          id: "approved-custom-accounting-title",
          value: "Financial Systems Analyst",
          status: "approved",
        }),
      ],
    });
    const persistedPreferences = parseSearchPreferencesMarkdown(
      serializeSearchPreferencesMarkdown(preferences),
    );
    const searchProfile = buildSearchProfile(
      careerProfile,
      persistedPreferences,
      taxonomy,
      now,
    );

    expect(
      createSearchPlan(searchProfile, now).queries.flatMap(
        (query) => query.terms,
      ),
    ).toContain("Financial Systems Analyst");
  });

  it("recommends providers only from explicitly configured catalog metadata", async () => {
    const taxonomy = await new YamlRoleTaxonomyRepository().load();
    const careerProfile = makeCareerProfile({
      profileId: "profile-provider-recommendations",
      preferredRoleFamilies: ["systems-integration"],
      seedTitles: ["Systems Integration Engineer"],
    });
    const defaults = createDefaultSearchPreferences(careerProfile.profileId);
    const preferences = SearchPreferencesSchema.parse({
      ...defaults,
      preferredIndustries: ["software-saas"],
      locationRules: {
        preferredLocations: [
          { city: "Portland", region: "Oregon", countryCode: "US" },
        ],
        excludedLocations: [],
      },
      sourcePreferences: [
        { providerId: "manual-user-supplied-source", enabled: true },
      ],
      workArrangement: { preferredModes: ["remote"] },
    });
    const searchProfile = buildSearchProfile(
      careerProfile,
      preferences,
      taxonomy,
      now,
    );
    const catalog = ProviderCatalogSchema.parse({
      schemaVersion: 1,
      catalogVersion: "1.0.0",
      providers: [
        {
          id: "matching-board",
          displayName: "Matching Board",
          providerType: "curated-board",
          countries: ["US"],
          roleFamilyIds: ["systems-integration"],
          industries: ["software-saas"],
          capabilities: ["remote-filtering"],
          authRequirements: ["None"],
          automationPolicy: "manual-only",
          enabled: true,
          status: "available",
        },
        {
          id: "manual-user-supplied-source",
          displayName: "Manual Source",
          providerType: "manual",
          countries: [],
          roleFamilyIds: [],
          industries: [],
          capabilities: [],
          authRequirements: ["None"],
          automationPolicy: "manual-only",
          enabled: true,
          status: "available",
        },
        {
          id: "unconfigured-board",
          displayName: "Unconfigured Board",
          providerType: "curated-board",
          countries: [],
          roleFamilyIds: [],
          industries: [],
          capabilities: [],
          authRequirements: ["Account required"],
          automationPolicy: "unknown",
          enabled: true,
          status: "available",
        },
        {
          id: "disabled-board",
          displayName: "Disabled Board",
          providerType: "curated-board",
          countries: ["US"],
          roleFamilyIds: ["systems-integration"],
          industries: [],
          capabilities: [],
          authRequirements: ["None"],
          automationPolicy: "manual-only",
          enabled: false,
          status: "disabled",
        },
        {
          id: "setup-board",
          displayName: "Setup Board",
          providerType: "public-api",
          countries: [],
          roleFamilyIds: [],
          industries: [],
          capabilities: [],
          authRequirements: ["API key"],
          automationPolicy: "authorized-api-only",
          enabled: true,
          status: "requires-configuration",
        },
        {
          id: "unsupported-board",
          displayName: "Unsupported Board",
          providerType: "curated-board",
          countries: [],
          roleFamilyIds: [],
          industries: [],
          capabilities: [],
          authRequirements: ["Unknown"],
          automationPolicy: "unknown",
          enabled: true,
          status: "unsupported",
        },
      ],
    });
    const recommendations = recommendProviders(searchProfile, catalog);
    const recommendationById = new Map(
      recommendations.map((recommendation) => [
        recommendation.provider.id,
        recommendation,
      ]),
    );

    expect(recommendationById.get("matching-board")?.status).toBe(
      "recommended",
    );
    expect(
      recommendationById
        .get("matching-board")
        ?.rationale.some((reason) => reason.includes("remote-filtering")),
    ).toBe(true);
    expect(
      recommendationById.get("manual-user-supplied-source")?.status,
    ).toBe("recommended");
    expect(recommendationById.get("unconfigured-board")?.status).toBe(
      "available",
    );
    expect(
      recommendationById.get("unconfigured-board")?.provider.capabilities,
    ).toEqual([]);
    expect(recommendationById.get("disabled-board")?.status).toBe("disabled");
    expect(recommendationById.get("setup-board")?.status).toBe(
      "requires-configuration",
    );
    expect(recommendationById.get("unsupported-board")?.status).toBe(
      "unsupported",
    );
    expect(
      recommendations.every((recommendation) => recommendation.rationale.length > 0),
    ).toBe(true);
  });

  it("keeps Tanner-specific values out of business logic", async () => {
    const files = [
      "lib/search-intelligence/engine.ts",
      "lib/search-intelligence/query-planner.ts",
      "lib/providers/recommendations.ts",
      "lib/search-preferences/model.ts",
      "lib/taxonomy/model.ts",
    ];
    const source = await Promise.all(
      files.map((file) => readFile(path.join(process.cwd(), file), "utf8")),
    );

    expect(source.join("\n")).not.toMatch(/Tanner|profile-tanner|97212/i);
  });
});

function makeCareerProfile(
  overrides: Partial<CareerProfile> = {},
): CareerProfile {
  return CareerProfileSchema.parse({
    schemaVersion: 1,
    profileId: "profile-synthetic",
    name: "Riley Example",
    targetIdentity: "Systems Engineer",
    preferredRoleFamilies: [],
    seedTitles: [],
    locations: {
      homeBase: { city: "Portland", region: "Oregon", postalCode: "97212" },
      additionalLocations: [],
      workModes: ["remote"],
    },
    skills: { primary: [], secondary: [] },
    compensation: {},
    searchPreferences: {
      allowGeneratedTerms: true,
      requireApprovalForGeneratedTerms: true,
      minimumCareerFit: 65,
    },
    searchTerms: [],
    jobSources: [],
    professionalDirection: "",
    ...overrides,
  });
}

function makeStoredTerm(
  overrides: Partial<SearchPreferences["terms"][number]> & {
    id: string;
    value: string;
    status: "approved" | "proposed" | "rejected" | "deferred";
  },
): SearchPreferences["terms"][number] {
  return {
    id: overrides.id,
    value: overrides.value,
    type: "title",
    status: overrides.status,
    source: "taxonomy",
    sourceReference: `taxonomy:title:${overrides.id}`,
    triggeringInputs: ["Full-Stack Systems Engineer"],
    rationale: "Persisted user search decision.",
    confidence: 0.8,
    roleFamilyIds: overrides.roleFamilyIds ?? [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
