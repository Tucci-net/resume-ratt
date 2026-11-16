import { z } from "zod";
import { CareerProfileSchema } from "../career-profile/model";
import { ProviderRecommendationSchema } from "../providers/model";
import { SearchPreferencesSchema } from "../search-preferences/model";
import { SearchPlanSchema, SearchProfileSchema } from "./model";

export const SearchStrategyDocumentSchema = z.object({
  profileId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  careerProfile: CareerProfileSchema,
  careerProfileRevision: z.string().regex(/^[a-f0-9]{64}$/),
  preferences: SearchPreferencesSchema,
  preferencesRevision: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  preferencesSource: z.enum([
    "legacy-compatibility",
    "search-preferences-markdown",
  ]),
  searchProfile: SearchProfileSchema,
  plan: SearchPlanSchema,
  providerRecommendations: z.array(ProviderRecommendationSchema),
});

export type SearchStrategyDocument = z.infer<
  typeof SearchStrategyDocumentSchema
>;
