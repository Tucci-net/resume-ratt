import type { SearchProfile } from "../search-intelligence/model";
import type {
  ProviderCatalog,
  ProviderRecommendation,
} from "./model";

export function recommendProviders(
  profile: SearchProfile,
  catalog: ProviderCatalog,
): ProviderRecommendation[] {
  const preferences = new Map(
    profile.sourcePreferences.map((preference) => [
      preference.providerId,
      preference,
    ]),
  );
  return catalog.providers
    .map((provider) => {
      const rationale: string[] = [];
      const preference = preferences.get(provider.id);
      if (preference?.enabled) {
        rationale.push("You enabled this source in your search preferences.");
      }

      const matchingRoleFamilies = provider.roleFamilyIds.filter((familyId) =>
        profile.approvedRoleFamilyIds.includes(familyId),
      );
      if (matchingRoleFamilies.length > 0) {
        rationale.push(
          `Configured for approved role families: ${matchingRoleFamilies.join(", ")}.`,
        );
      }

      const matchingIndustries = provider.industries.filter((industryId) =>
        profile.preferredIndustries.includes(industryId),
      );
      if (matchingIndustries.length > 0) {
        rationale.push(
          `Configured for preferred industries: ${matchingIndustries.join(", ")}.`,
        );
      }

      const requestedCountries = new Set(
        profile.locationRules.preferredLocations
          .map((location) => location.countryCode)
          .filter((country): country is string => country !== undefined),
      );
      const matchingCountries = provider.countries.filter((country) =>
        requestedCountries.has(country),
      );
      if (matchingCountries.length > 0) {
        rationale.push(
          `Configured for requested countries: ${matchingCountries.join(", ")}.`,
        );
      }

      if (
        profile.workArrangement.preferredModes.includes("remote") &&
        provider.capabilities.includes("remote-filtering")
      ) {
        rationale.push(
          "Configured remote-filtering capability matches your remote preference.",
        );
      }
      if (preference?.notes) {
        rationale.push(`User note: ${preference.notes}`);
      }

      const hasConfiguredMatch =
        matchingRoleFamilies.length > 0 ||
        matchingIndustries.length > 0 ||
        matchingCountries.length > 0 ||
        (profile.workArrangement.preferredModes.includes("remote") &&
          provider.capabilities.includes("remote-filtering"));
      let status: ProviderRecommendation["status"];
      if (!provider.enabled || provider.status === "disabled") {
        status = "disabled";
        rationale.push("This provider is disabled in the catalog.");
      } else if (provider.status === "unsupported") {
        status = "unsupported";
        rationale.push("This provider is marked unsupported in the catalog.");
      } else if (provider.status === "requires-configuration") {
        status = "requires-configuration";
        rationale.push("This provider needs configuration before use.");
      } else if (preference?.enabled || hasConfiguredMatch) {
        status = "recommended";
        if (!preference?.enabled && hasConfiguredMatch) {
          rationale.push(
            "Configured provider metadata matches this search profile.",
          );
        }
      } else {
        status = "available";
        rationale.push(
          "Available in the catalog; no configured metadata currently matches this search profile.",
        );
      }
      if (rationale.length === 0) {
        rationale.push("Provider metadata is available in the catalog.");
      }
      return { provider, status, rationale };
    })
    .sort((left, right) => {
      const priority = {
        recommended: 0,
        available: 1,
        "requires-configuration": 2,
        disabled: 3,
        unsupported: 4,
      };
      return (
        priority[left.status] - priority[right.status] ||
        left.provider.displayName.localeCompare(right.provider.displayName)
      );
    });
}
