import { z } from "zod";
import { SearchTermSchema } from "../search-preferences/model";

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const RoleFamilyRecommendationSchema = z.object({
  roleFamilyId: idSchema,
  label: z.string().trim().min(1),
  status: z.enum(["approved", "proposed", "rejected", "deferred"]),
  rationale: z.string().trim().min(1),
  sourceReference: z.string().trim().min(1),
  triggeringInputs: z.array(z.string().trim().min(1)),
  confidence: z.number().min(0).max(1),
  driftWarning: z.string().trim().min(1).optional(),
});

export const SearchProfileSchema = z.object({
  profileId: idSchema,
  version: z.number().int().positive(),
  taxonomyVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  userInput: z.object({
    name: z.string().trim().min(1),
    targetIdentity: z.string().trim().min(1),
    professionalDirection: z.string(),
    preferredRoleFamilies: z.array(z.string().trim().min(1)),
    seedTitles: z.array(z.string().trim().min(1)),
    desiredResponsibilities: z.array(z.string().trim().min(1)),
    primarySkills: z.array(z.string().trim().min(1)),
    transferableSkills: z.array(z.string().trim().min(1)),
    negativeKeywords: z.array(z.string().trim().min(1)),
  }),
  roleFamilies: z.array(RoleFamilyRecommendationSchema),
  terms: z.array(SearchTermSchema),
  approvedRoleFamilyIds: z.array(idSchema),
  seedTitles: z.array(SearchTermSchema),
  approvedTitles: z.array(SearchTermSchema),
  approvedAdjacentTitles: z.array(SearchTermSchema),
  proposedTitles: z.array(SearchTermSchema),
  rejectedTitles: z.array(SearchTermSchema),
  deferredTitles: z.array(SearchTermSchema),
  responsibilities: z.array(SearchTermSchema),
  proposedResponsibilities: z.array(SearchTermSchema),
  primarySkills: z.array(z.string().trim().min(1)),
  transferableSkills: z.array(z.string().trim().min(1)),
  proposedSkills: z.array(SearchTermSchema),
  negativeKeywords: z.array(z.string().trim().min(1)),
  preferredIndustries: z.array(idSchema),
  excludedIndustries: z.array(idSchema),
  seniorityPreferences: z.array(
    z.enum(["intern", "junior", "mid", "senior", "staff", "principal", "lead"]),
  ),
  locationRules: z.object({
    preferredLocations: z.array(
      z.object({
        city: z.string().trim().min(1),
        region: z.string().trim().min(1),
        postalCode: z.string().trim().min(1).optional(),
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
});

export const SearchQuerySchema = z.object({
  id: idSchema,
  terms: z.array(z.string().trim().min(1)),
  excludedTerms: z.array(z.string().trim().min(1)),
  roleFamilyIds: z.array(idSchema),
  locations: SearchProfileSchema.shape.locationRules.shape.preferredLocations,
  excludedLocations: SearchProfileSchema.shape.locationRules.shape.excludedLocations,
  remotePreference: z.array(z.enum(["remote", "hybrid", "onsite"])),
  seniority: SearchProfileSchema.shape.seniorityPreferences,
  rationale: z.string().trim().min(1),
  driftRisk: z.boolean(),
});

export const SearchPlanSchema = z.object({
  profileId: idSchema,
  version: z.number().int().positive(),
  taxonomyVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  generatedAt: z.string().datetime({ offset: true }),
  queries: z.array(SearchQuerySchema),
});

export type RoleFamilyRecommendation = z.infer<
  typeof RoleFamilyRecommendationSchema
>;
export type SearchProfile = z.infer<typeof SearchProfileSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchPlan = z.infer<typeof SearchPlanSchema>;
