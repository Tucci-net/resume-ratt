import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const ProviderCapabilitySchema = z.enum([
  "keyword-search",
  "title-search",
  "location-filtering",
  "remote-filtering",
  "compensation-filtering",
  "date-filtering",
  "fetch-by-url",
  "structured-description",
  "pagination",
]);

export const JobProviderSchema = z.object({
  id: idSchema,
  displayName: z.string().trim().min(1),
  providerType: z.enum([
    "manual",
    "public-api",
    "rss",
    "ats-greenhouse",
    "ats-lever",
    "ats-ashby",
    "government",
    "curated-board",
    "company-career-site",
  ]),
  homepage: z.string().url().optional(),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)),
  roleFamilyIds: z.array(idSchema),
  industries: z.array(idSchema),
  capabilities: z.array(ProviderCapabilitySchema),
  authRequirements: z.array(z.string().trim().min(1)),
  automationPolicy: z.enum([
    "manual-only",
    "authorized-api-only",
    "terms-review-required",
    "unknown",
  ]),
  enabled: z.boolean(),
  status: z.enum([
    "available",
    "disabled",
    "unsupported",
    "requires-configuration",
  ]),
  lastVerifiedAt: z.string().datetime({ offset: true }).optional(),
});

export const ProviderCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  catalogVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  providers: z.array(JobProviderSchema),
});

export const ProviderRecommendationSchema = z.object({
  provider: JobProviderSchema,
  status: z.enum([
    "recommended",
    "available",
    "disabled",
    "unsupported",
    "requires-configuration",
  ]),
  rationale: z.array(z.string().trim().min(1)).min(1),
});

export type JobProvider = z.infer<typeof JobProviderSchema>;
export type ProviderCatalog = z.infer<typeof ProviderCatalogSchema>;
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;
export type ProviderRecommendation = z.infer<
  typeof ProviderRecommendationSchema
>;

export function validateProviderCatalog(
  catalog: ProviderCatalog,
  taxonomy: {
    families: Array<{ id: string }>;
    industries: Array<{ id: string }>;
  },
): void {
  const providerIds = new Set<string>();
  const familyIds = new Set(taxonomy.families.map((family) => family.id));
  const industryIds = new Set(
    taxonomy.industries.map((industry) => industry.id),
  );
  for (const provider of catalog.providers) {
    if (providerIds.has(provider.id)) {
      throw new Error(`Duplicate provider ID: ${provider.id}`);
    }
    providerIds.add(provider.id);
    for (const roleFamilyId of provider.roleFamilyIds) {
      if (!familyIds.has(roleFamilyId)) {
        throw new Error(
          `Provider "${provider.id}" references unknown role family "${roleFamilyId}".`,
        );
      }
    }
    for (const industryId of provider.industries) {
      if (!industryIds.has(industryId)) {
        throw new Error(
          `Provider "${provider.id}" references unknown industry "${industryId}".`,
        );
      }
    }
  }
}
