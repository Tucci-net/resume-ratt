import { CareerProfileSchema } from "./model";
import type {
  CareerProfile,
  CareerProfileDocument,
} from "./model";
import type { CareerProfileRepository } from "./repository";

export class CareerProfileService {
  constructor(private readonly repository: CareerProfileRepository) {}

  async loadProfile(profileId: string): Promise<CareerProfileDocument> {
    const document = await this.repository.loadProfile(profileId);
    return {
      profile: CareerProfileSchema.parse(document.profile),
      revision: document.revision,
    };
  }

  validateProfile(value: unknown): CareerProfile {
    return CareerProfileSchema.parse(value);
  }

  async updateProfile(
    profileId: string,
    value: unknown,
    expectedRevision: string,
  ): Promise<CareerProfileDocument> {
    const profile = this.validateProfile(value);
    if (profile.profileId !== profileId) {
      throw new Error("Career profile ID cannot be changed while saving.");
    }
    return this.repository.saveProfile(profileId, profile, expectedRevision);
  }

  async exportProfile(profileId: string): Promise<string> {
    return this.repository.exportProfile(profileId);
  }
}
