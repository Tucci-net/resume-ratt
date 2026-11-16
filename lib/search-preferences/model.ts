import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const dateSchema = z.string().datetime({ offset: true });

export const SearchTermSchema = z.object({
  id: idSchema,
  value: z.string().trim().min(1),
  type: z.enum(["title", "responsibility", "skill", "industry", "negative"]),
  status: z.enum(["seed", "proposed", "approved", "rejected", "deferred"]),
  source: z.enum(["user", "taxonomy", "rule", "ai"]),
  sourceReference: z.string().trim().min(1),
  triggeringInputs: z.array(z.string().trim().min(1)),
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  roleFamilyIds: z.array(idSchema),
  driftWarning: z.string().trim().min(1).optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export const SearchPreferencesSchema = z
  .object({
    schemaVersion: z.literal(1),
    profileId: idSchema,
    version: z.number().int().positive(),
    terms: z.array(SearchTermSchema),
    roleFamilyDecisions: z.array(
      z.object({
        roleFamilyId: idSchema,
        status: z.enum(["approved", "rejected", "deferred"]),
        rationale: z.string().trim().min(1),
        updatedAt: dateSchema,
      }),
    ),
    desiredResponsibilities: z.array(z.string().trim().min(1)),
    negativeKeywords: z.array(z.string().trim().min(1)),
    preferredIndustries: z.array(idSchema),
    excludedIndustries: z.array(idSchema),
    seniorityPreferences: z.array(
      z.enum([
        "intern",
        "junior",
        "mid",
        "senior",
        "staff",
        "principal",
        "lead",
      ]),
    ),
    locationRules: z.object({
      preferredLocations: z.array(
        z.object({
          city: z.string().trim().min(1),
          region: z.string().trim().min(1),
          countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
        }),
      ),
      excludedLocations: z.array(
        z.object({
          city: z.string().trim().min(1).optional(),
          region: z.string().trim().min(1).optional(),
          countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
        }),
      ),
      willingToRelocate: z.boolean().optional(),
    }),
    compensationRules: z.object({
      currency: z.string().regex(/^[A-Z]{3}$/).optional(),
      minimumAnnual: z.number().finite().nonnegative().optional(),
      maximumAnnual: z.number().finite().nonnegative().optional(),
      notes: z.string().trim().optional(),
    }),
    workArrangement: z.object({
      preferredModes: z.array(z.enum(["remote", "hybrid", "onsite"])),
    }),
    workAuthorization: z.object({
      countries: z.array(z.string().regex(/^[A-Z]{2}$/)),
      requiresSponsorship: z.boolean().nullable(),
      notes: z.string().trim().optional(),
    }),
    sourcePreferences: z.array(
      z.object({
        providerId: idSchema,
        enabled: z.boolean(),
        notes: z.string().trim().optional(),
      }),
    ),
    queryPlanning: z.object({
      allowTaxonomyExpansion: z.boolean(),
      minimumConfidence: z.number().min(0).max(1),
      maximumQueries: z.number().int().min(1).max(50),
    }),
  })
  .superRefine((preferences, context) => {
    const termIds = new Set<string>();
    const termValues = new Set<string>();
    preferences.terms.forEach((term, index) => {
      if (termIds.has(term.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["terms", index, "id"],
          message: `Duplicate search term ID: ${term.id}`,
        });
      }
      termIds.add(term.id);
      const key = `${term.type}:${normalizeTerm(term.value)}`;
      if (termValues.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["terms", index, "value"],
          message: `Duplicate ${term.type} search term: ${term.value}`,
        });
      }
      termValues.add(key);
    });

    const familyIds = new Set<string>();
    preferences.roleFamilyDecisions.forEach((decision, index) => {
      if (familyIds.has(decision.roleFamilyId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roleFamilyDecisions", index, "roleFamilyId"],
          message: `Duplicate role family decision: ${decision.roleFamilyId}`,
        });
      }
      familyIds.add(decision.roleFamilyId);
    });

    const providerIds = new Set<string>();
    preferences.sourcePreferences.forEach((source, index) => {
      if (providerIds.has(source.providerId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourcePreferences", index, "providerId"],
          message: `Duplicate source preference: ${source.providerId}`,
        });
      }
      providerIds.add(source.providerId);
    });

    const preferredIndustries = new Set(preferences.preferredIndustries);
    preferences.excludedIndustries.forEach((industryId, index) => {
      if (preferredIndustries.has(industryId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["excludedIndustries", index],
          message: `Industry "${industryId}" cannot be both preferred and excluded.`,
        });
      }
    });

    const { minimumAnnual, maximumAnnual } = preferences.compensationRules;
    if (
      minimumAnnual !== undefined &&
      maximumAnnual !== undefined &&
      minimumAnnual > maximumAnnual
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compensationRules", "maximumAnnual"],
        message: "Maximum annual compensation must be at least the minimum.",
      });
    }
  });

export type SearchTerm = z.infer<typeof SearchTermSchema>;
export type SearchPreferences = z.infer<typeof SearchPreferencesSchema>;

export type LegacySearchSettings = {
  searchPreferences: {
    allowGeneratedTerms: boolean;
    requireApprovalForGeneratedTerms: true;
    minimumCareerFit: number;
  };
  searchTerms: Array<{
    id: string;
    term: string;
    source: "taxonomy" | "ai";
    status: "pending" | "approved" | "rejected" | "deferred";
  }>;
  jobSources: Array<{
    providerId: string;
    enabled: boolean;
  }>;
};

function normalizeTerm(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function createDefaultSearchPreferences(
  profileId: string,
): SearchPreferences {
  return SearchPreferencesSchema.parse({
    schemaVersion: 1,
    profileId,
    version: 1,
    terms: [],
    roleFamilyDecisions: [],
    desiredResponsibilities: [],
    negativeKeywords: [],
    preferredIndustries: [],
    excludedIndustries: [],
    seniorityPreferences: [],
    locationRules: {
      preferredLocations: [],
      excludedLocations: [],
    },
    compensationRules: {},
    workArrangement: { preferredModes: [] },
    workAuthorization: { countries: [], requiresSponsorship: null },
    sourcePreferences: [],
    queryPlanning: {
      allowTaxonomyExpansion: true,
      minimumConfidence: 0.65,
      maximumQueries: 12,
    },
  });
}

export function createSearchPreferencesFromLegacy(
  profileId: string,
  legacy: LegacySearchSettings,
  now: Date,
): SearchPreferences {
  const timestamp = now.toISOString();
  const defaults = createDefaultSearchPreferences(profileId);
  return SearchPreferencesSchema.parse({
    ...defaults,
    terms: legacy.searchTerms.map((term) => ({
      id: term.id,
      value: term.term,
      type: "title",
      status: term.status === "pending" ? "proposed" : term.status,
      source: term.source,
      sourceReference: `legacy-search-term:${term.id}`,
      triggeringInputs: [term.term],
      rationale: "Imported from the legacy CareerProfile search-term list.",
      confidence: 1,
      roleFamilyIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    sourcePreferences: legacy.jobSources.map((source) => ({
      providerId: source.providerId,
      enabled: source.enabled,
    })),
    queryPlanning: {
      ...defaults.queryPlanning,
      allowTaxonomyExpansion: legacy.searchPreferences.allowGeneratedTerms,
      minimumConfidence: legacy.searchPreferences.minimumCareerFit / 100,
    },
  });
}
