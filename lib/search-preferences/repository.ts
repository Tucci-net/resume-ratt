import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { SearchPreferencesSchema } from "./model";
import type { SearchPreferences } from "./model";
import {
  parseSearchPreferencesMarkdown,
  serializeSearchPreferencesMarkdown,
} from "./format";

export type SearchPreferencesDocument = {
  preferences: SearchPreferences;
  revision: string | null;
};

export class SearchPreferencesRevisionConflictError extends Error {
  constructor() {
    super(
      "Search preferences changed since they were loaded. Reload them before saving.",
    );
    this.name = "SearchPreferencesRevisionConflictError";
  }
}

export class MarkdownSearchPreferencesRepository {
  constructor(private readonly profilesDirectory: string) {}

  async loadPreferences(
    profileId: string,
  ): Promise<SearchPreferencesDocument | null> {
    const markdown = await this.readMarkdown(profileId);
    if (markdown === null) {
      return null;
    }
    const preferences = parseSearchPreferencesMarkdown(markdown);
    if (preferences.profileId !== profileId) {
      throw new Error(
        `Search preferences profile ID "${preferences.profileId}" does not match "${profileId}".`,
      );
    }
    return { preferences, revision: revisionOf(markdown) };
  }

  async savePreferences(
    profileId: string,
    value: unknown,
    expectedRevision: string | null,
  ): Promise<SearchPreferencesDocument> {
    const preferences = SearchPreferencesSchema.parse(value);
    if (preferences.profileId !== profileId) {
      throw new Error("Search preferences profile ID cannot be changed.");
    }
    const filePath = this.preferencesPath(profileId);
    const existingMarkdown = await this.readMarkdown(profileId);
    if (revisionOf(existingMarkdown) !== expectedRevision) {
      throw new SearchPreferencesRevisionConflictError();
    }

    const markdown = serializeSearchPreferencesMarkdown(preferences);
    const profileDirectory = path.dirname(filePath);
    await mkdir(profileDirectory, { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    let temporaryFileExists = false;
    try {
      await writeFile(temporaryPath, markdown, {
        encoding: "utf8",
        flag: "wx",
      });
      temporaryFileExists = true;
      await rename(temporaryPath, filePath);
      temporaryFileExists = false;
    } finally {
      if (temporaryFileExists) {
        await unlink(temporaryPath);
      }
    }
    return { preferences, revision: revisionOf(markdown) };
  }

  async exportPreferences(profileId: string): Promise<string> {
    const markdown = await this.readMarkdown(profileId);
    if (markdown === null) {
      throw new Error(`Search preferences for "${profileId}" were not found.`);
    }
    return markdown;
  }

  private preferencesPath(profileId: string): string {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(profileId)) {
      throw new Error("Search preferences profile ID is invalid.");
    }
    return path.join(
      this.profilesDirectory,
      profileId,
      "search-preferences.md",
    );
  }

  private async readMarkdown(profileId: string): Promise<string | null> {
    const filePath = this.preferencesPath(profileId);
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      if (isFileNotFound(error)) {
        return null;
      }
      throw error;
    }
  }
}

function revisionOf(markdown: string | null): string | null {
  return markdown === null
    ? null
    : createHash("sha256").update(markdown).digest("hex");
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
