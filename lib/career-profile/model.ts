import { z } from "zod";

const textListSchema = z
  .array(z.string().trim().min(1))
  .max(100);

const locationSchema = z.object({
  city: z.string().trim().min(1),
  region: z.string().trim().min(1),
  postalCode: z.string().trim().min(1),
});

const searchTermSchema = z.object({
  id: z.string().trim().min(1),
  term: z.string().trim().min(1),
  source: z.enum(["taxonomy", "ai"]),
  status: z.enum(["pending", "approved", "rejected", "deferred"]),
});

const jobSourceSchema = z.object({
  providerId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  providerName: z.string().trim().min(1),
  enabled: z.boolean(),
  capabilities: textListSchema,
  geographicRelevance: z.string().trim(),
  industryRelevance: z.string().trim(),
  status: z.enum(["available", "planned", "unavailable"]),
  recommendationReason: z.string().trim(),
});

export const CareerProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    profileId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: z.string().trim().min(1),
    targetIdentity: z.string().trim().min(1),
    preferredRoleFamilies: textListSchema,
    seedTitles: textListSchema,
    locations: z.object({
      homeBase: locationSchema,
      additionalLocations: z.array(locationSchema).default([]),
      workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).default([]),
      willingToRelocate: z.boolean().optional(),
    }),
    skills: z.object({
      primary: textListSchema,
      secondary: textListSchema,
    }),
    compensation: z
      .object({
        currency: z.string().regex(/^[A-Z]{3}$/).optional(),
        minimumAnnual: z.number().finite().nonnegative().optional(),
        maximumAnnual: z.number().finite().nonnegative().optional(),
        notes: z.string().trim().optional(),
      })
      .default({}),
    searchPreferences: z.object({
      allowGeneratedTerms: z.boolean(),
      requireApprovalForGeneratedTerms: z.literal(true),
      minimumCareerFit: z.number().int().min(0).max(100),
    }),
    searchTerms: z.array(searchTermSchema).default([]),
    jobSources: z.array(jobSourceSchema).default([]),
    professionalDirection: z.string().trim().default(""),
  })
  .superRefine((profile, context) => {
    const { minimumAnnual, maximumAnnual } = profile.compensation;
    if (
      minimumAnnual !== undefined &&
      maximumAnnual !== undefined &&
      minimumAnnual > maximumAnnual
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compensation", "maximumAnnual"],
        message: "Maximum annual compensation must be at least the minimum.",
      });
    }

    const termIds = new Set<string>();
    profile.searchTerms.forEach((term, index) => {
      if (termIds.has(term.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["searchTerms", index, "id"],
          message: `Duplicate search term ID: ${term.id}`,
        });
      }
      termIds.add(term.id);
    });

    const providerIds = new Set<string>();
    profile.jobSources.forEach((source, index) => {
      if (providerIds.has(source.providerId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["jobSources", index, "providerId"],
          message: `Duplicate job source ID: ${source.providerId}`,
        });
      }
      providerIds.add(source.providerId);
    });
  });

export type CareerProfile = z.infer<typeof CareerProfileSchema>;

export const CareerProfileDocumentSchema = z.object({
  profile: CareerProfileSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});

export type CareerProfileDocument = {
  profile: CareerProfile;
  revision: string;
};
