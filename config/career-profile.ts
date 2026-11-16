const DEVELOPMENT_SEED_PROFILE_ID = "profile-tanner";

export function getDefaultCareerProfileId(): string | null {
  const configuredProfileId = process.env.CAREER_PROFILE_ID?.trim();
  if (configuredProfileId) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(configuredProfileId)) {
      throw new Error(
        "CAREER_PROFILE_ID must contain only lowercase letters, numbers, and hyphens.",
      );
    }
    return configuredProfileId;
  }
  return process.env.NODE_ENV === "development"
    ? DEVELOPMENT_SEED_PROFILE_ID
    : null;
}
