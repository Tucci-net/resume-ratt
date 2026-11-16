import { SearchPreferencesSchema } from "./model";
import type {
  LegacySearchSettings,
  SearchPreferences,
} from "./model";
import type {
  SearchPreferencesDocument,
  MarkdownSearchPreferencesRepository,
} from "./repository";
import {
  SearchPreferencesRevisionConflictError,
} from "./repository";
import {
  createDefaultSearchPreferences,
  createSearchPreferencesFromLegacy,
} from "./model";

export class SearchPreferencesService {
  constructor(
    private readonly repository: MarkdownSearchPreferencesRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async loadPreferences(
    profileId: string,
    legacy?: LegacySearchSettings,
  ): Promise<SearchPreferencesDocument> {
    const document = await this.repository.loadPreferences(profileId);
    if (document) {
      return document;
    }
    return {
      preferences: legacy
        ? createSearchPreferencesFromLegacy(profileId, legacy, this.now())
        : createDefaultSearchPreferences(profileId),
      revision: null,
    };
  }

  validatePreferences(value: unknown): SearchPreferences {
    return SearchPreferencesSchema.parse(value);
  }

  async savePreferences(
    profileId: string,
    value: unknown,
    expectedRevision: string | null,
  ): Promise<SearchPreferencesDocument> {
    const preferences = this.validatePreferences(value);
    if (preferences.profileId !== profileId) {
      throw new Error("Search preferences profile ID cannot be changed.");
    }
    const current = await this.repository.loadPreferences(profileId);
    if ((current?.revision ?? null) !== expectedRevision) {
      throw new SearchPreferencesRevisionConflictError();
    }
    return this.repository.savePreferences(
      profileId,
      {
        ...preferences,
        version: (current?.preferences.version ?? 0) + 1,
      },
      expectedRevision,
    );
  }
}
