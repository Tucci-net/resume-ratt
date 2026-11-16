import path from "node:path";
import { careerProfileService } from "../career-profile/runtime";
import { YamlProviderCatalogRepository } from "../providers/repository";
import { recommendProviders } from "../providers/recommendations";
import { MarkdownSearchPreferencesRepository } from "../search-preferences/repository";
import { SearchPreferencesService } from "../search-preferences/service";
import type { LegacySearchSettings } from "../search-preferences/model";
import { YamlRoleTaxonomyRepository } from "../taxonomy/repository";
import { buildSearchProfile } from "./engine";
import { createSearchPlan } from "./query-planner";
import { SearchStrategyDocumentSchema } from "./api-model";
import type { SearchStrategyDocument } from "./api-model";

const profilesDirectory =
  process.env.CAREER_PROFILE_DIRECTORY ??
  path.join(process.cwd(), "profiles");

const searchPreferencesService = new SearchPreferencesService(
  new MarkdownSearchPreferencesRepository(profilesDirectory),
);
const taxonomyRepository = new YamlRoleTaxonomyRepository();
const providerCatalogRepository = new YamlProviderCatalogRepository();

export async function loadSearchStrategy(profileId: string) {
  const careerDocument = await careerProfileService.loadProfile(profileId);
  const legacy: LegacySearchSettings = {
    searchPreferences: careerDocument.profile.searchPreferences,
    searchTerms: careerDocument.profile.searchTerms,
    jobSources: careerDocument.profile.jobSources,
  };
  const [preferencesDocument, taxonomy] = await Promise.all([
    searchPreferencesService.loadPreferences(profileId, legacy),
    taxonomyRepository.load(),
  ]);
  const catalog = await providerCatalogRepository.load(taxonomy);
  const searchProfile = buildSearchProfile(
    careerDocument.profile,
    preferencesDocument.preferences,
    taxonomy,
  );
  const plan = createSearchPlan(searchProfile);
  const providerRecommendations = recommendProviders(searchProfile, catalog);

  return SearchStrategyDocumentSchema.parse({
    profileId,
    careerProfile: careerDocument.profile,
    careerProfileRevision: careerDocument.revision,
    preferences: preferencesDocument.preferences,
    preferencesRevision: preferencesDocument.revision,
    preferencesSource:
      preferencesDocument.revision === null
        ? "legacy-compatibility"
        : "search-preferences-markdown",
    searchProfile,
    plan,
    providerRecommendations,
  });
}

export async function saveSearchPreferences(
  profileId: string,
  value: unknown,
  expectedRevision: string | null,
) {
  const saved = await searchPreferencesService.savePreferences(
    profileId,
    value,
    expectedRevision,
  );
  const strategy = await loadSearchStrategy(profileId);
  return SearchStrategyDocumentSchema.parse({
    ...strategy,
    preferences: saved.preferences,
    preferencesRevision: saved.revision,
    preferencesSource: "search-preferences-markdown",
  }) satisfies SearchStrategyDocument;
}
