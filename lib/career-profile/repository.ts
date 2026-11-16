import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CareerProfileSchema } from "./model";
import type {
  CareerProfile,
  CareerProfileDocument,
} from "./model";
import {
  parseCareerProfileMarkdown,
  serializeCareerProfileMarkdown,
} from "./format";

export interface CareerProfileRepository {
  loadProfile(profileId: string): Promise<CareerProfileDocument>;
  saveProfile(
    profileId: string,
    profile: CareerProfile,
    expectedRevision: string,
  ): Promise<CareerProfileDocument>;
  exportProfile(profileId: string): Promise<string>;
}

export class ProfileNotFoundError extends Error {
  constructor(profileId: string) {
    super(`Career profile "${profileId}" was not found.`);
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileRevisionConflictError extends Error {
  constructor() {
    super("This profile changed since it was loaded. Reload it before saving.");
    this.name = "ProfileRevisionConflictError";
  }
}

export class MarkdownCareerProfileRepository
  implements CareerProfileRepository
{
  constructor(private readonly profilesDirectory: string) {}

  async loadProfile(profileId: string): Promise<CareerProfileDocument> {
    const filePath = this.profilePath(profileId);
    const markdown = await this.readMarkdown(profileId, filePath);
    const profile = parseCareerProfileMarkdown(markdown);
    if (profile.profileId !== profileId) {
      throw new Error(
        `Career profile ID "${profile.profileId}" does not match "${profileId}".`,
      );
    }
    return { profile, revision: revisionOf(markdown) };
  }

  async saveProfile(
    profileId: string,
    profile: CareerProfile,
    expectedRevision: string,
  ): Promise<CareerProfileDocument> {
    const validatedProfile = CareerProfileSchema.parse(profile);
    if (validatedProfile.profileId !== profileId) {
      throw new Error("Career profile ID cannot be changed while saving.");
    }

    const filePath = this.profilePath(profileId);
    const existingMarkdown = await this.readMarkdown(profileId, filePath);
    if (revisionOf(existingMarkdown) !== expectedRevision) {
      throw new ProfileRevisionConflictError();
    }

    const markdown = serializeCareerProfileMarkdown(validatedProfile);
    await mkdir(this.profilesDirectory, { recursive: true });
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

    return { profile: validatedProfile, revision: revisionOf(markdown) };
  }

  async exportProfile(profileId: string): Promise<string> {
    return this.readMarkdown(profileId, this.profilePath(profileId));
  }

  private profilePath(profileId: string): string {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(profileId)) {
      throw new Error("Career profile ID is invalid.");
    }
    return path.join(this.profilesDirectory, `${profileId}.md`);
  }

  private async readMarkdown(
    profileId: string,
    filePath: string,
  ): Promise<string> {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new ProfileNotFoundError(profileId);
      }
      throw error;
    }
  }
}

function revisionOf(markdown: string): string {
  return createHash("sha256").update(markdown).digest("hex");
}
