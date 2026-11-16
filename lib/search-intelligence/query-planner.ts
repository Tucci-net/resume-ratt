import { SearchPlanSchema } from "./model";
import type { SearchPlan, SearchProfile } from "./model";

type QueryGroup = {
  key: string;
  roleFamilyId?: string;
  title?: string;
};

export function createSearchPlan(
  profile: SearchProfile,
  generatedAt: Date = new Date(),
): SearchPlan {
  const activeTitles = profile.terms.filter(
    (term) =>
      term.type === "title" &&
      (term.status === "seed" || term.status === "approved"),
  );
  const approvedFamilyIds = new Set(profile.approvedRoleFamilyIds);
  const groups = new Map<string, QueryGroup>();
  for (const title of activeTitles) {
    const approvedFamilies = title.roleFamilyIds.filter((familyId) =>
      approvedFamilyIds.has(familyId),
    );
    if (approvedFamilies.length === 0) {
      const key = `title-${title.id}`;
      groups.set(key, { key, title: title.value });
      continue;
    }
    for (const roleFamilyId of approvedFamilies) {
      const key = `family-${roleFamilyId}`;
      groups.set(key, { key, roleFamilyId });
    }
  }
  if (activeTitles.length === 0) {
    for (const roleFamilyId of profile.approvedRoleFamilyIds) {
      const key = `family-${roleFamilyId}`;
      groups.set(key, { key, roleFamilyId });
    }
  }

  const excludedTerms = uniqueTerms(profile.negativeKeywords);
  const queries = [...groups.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(0, profile.queryPlanning.maximumQueries)
    .map((group) => {
      const roleFamilyId = group.roleFamilyId;
      const familyTerms = roleFamilyId
        ? profile.terms.filter((term) =>
            term.roleFamilyIds.includes(roleFamilyId),
          )
        : [];
      const activeTerms = familyTerms.filter(
        (term) =>
          (term.status === "seed" || term.status === "approved") &&
          ["title", "skill", "responsibility", "industry"].includes(term.type),
      );
      const titleTerms = group.title
        ? [group.title]
        : activeTitles
            .filter(
              (term) =>
                group.roleFamilyId &&
                term.roleFamilyIds.includes(group.roleFamilyId),
            )
            .map((term) => term.value);
      const familyLabel = profile.roleFamilies.find(
        (family) => family.roleFamilyId === group.roleFamilyId,
      )?.label;
      const terms = uniqueTerms([
        ...titleTerms,
        ...activeTerms.map((term) => term.value),
        ...(activeTerms.length === 0 && familyLabel ? [familyLabel] : []),
      ]);
      const hasDriftRisk = activeTerms.some(
        (term) => term.driftWarning !== undefined,
      );
      return {
        id: group.key,
        terms,
        excludedTerms,
        roleFamilyIds: group.roleFamilyId ? [group.roleFamilyId] : [],
        locations: profile.locationRules.preferredLocations,
        excludedLocations: profile.locationRules.excludedLocations,
        remotePreference: profile.workArrangement.preferredModes,
        seniority: profile.seniorityPreferences,
        rationale: group.roleFamilyId
          ? `Focused on approved search terms associated with ${familyLabel ?? group.roleFamilyId}.`
          : `Focused on the approved title "${group.title}".`,
        driftRisk: hasDriftRisk,
      };
    })
    .filter((query) => query.terms.length > 0);

  return SearchPlanSchema.parse({
    profileId: profile.profileId,
    version: profile.version,
    taxonomyVersion: profile.taxonomyVersion,
    generatedAt: generatedAt.toISOString(),
    queries,
  });
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  return terms
    .map((term) => term.trim())
    .filter((term) => {
      const key = term.normalize("NFKC").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.localeCompare(right));
}
