import { SearchProfileSchema } from "./model";
import type {
  RoleFamilyRecommendation,
  SearchProfile,
} from "./model";
import { SearchTermSchema } from "../search-preferences/model";
import type { SearchTerm } from "../search-preferences/model";
import type { CareerProfile } from "../career-profile/model";
import type { SearchPreferences } from "../search-preferences/model";
import type {
  RoleFamily,
  RoleTaxonomy,
  RoleTitle,
  TaxonomyAlias,
} from "../taxonomy/model";

type FamilyEvidence = {
  confidence: number;
  userApproved: boolean;
  rationale: string;
  sourceReference: string;
  triggeringInputs: string[];
  driftWarning?: string;
};

type TitleCandidate = {
  title: RoleTitle;
  confidence: number;
  rationale: string;
  triggeringInputs: string[];
  driftWarning?: string;
};

export function buildSearchProfile(
  careerProfile: CareerProfile,
  preferences: SearchPreferences,
  taxonomy: RoleTaxonomy,
  now: Date = new Date(),
): SearchProfile {
  if (careerProfile.profileId !== preferences.profileId) {
    throw new Error("Career profile and search preferences IDs do not match.");
  }
  validatePreferenceReferences(preferences, taxonomy);

  const timestamp = now.toISOString();
  const familyById = new Map(
    taxonomy.families.map((family) => [family.id, family]),
  );
  const generatedTerms: SearchTerm[] = [];
  const addCandidate = (candidate: SearchTerm): void => {
    generatedTerms.push(candidate);
  };
  const roleFamiliesByName = indexRoleFamilies(taxonomy.families);
  const titleMatches = indexEntities(
    taxonomy.titles,
    taxonomy.aliases,
    "role-title",
  );
  const skillMatches = indexEntities(taxonomy.skills, taxonomy.aliases, "skill");
  const responsibilityMatches = indexEntities(
    taxonomy.responsibilities,
    taxonomy.aliases,
    "responsibility",
    (responsibility) => responsibility.phrases,
  );
  const familyEvidence = new Map<string, FamilyEvidence>();

  for (const inputFamily of careerProfile.preferredRoleFamilies) {
    const familyId = roleFamiliesByName.get(normalizeSearchText(inputFamily));
    if (familyId) {
      familyEvidence.set(familyId, {
        confidence: 1,
        userApproved: true,
        rationale: `The user selected ${familyById.get(familyId)?.label ?? inputFamily} as a preferred role family.`,
        sourceReference: "career-profile.preferredRoleFamilies",
        triggeringInputs: [inputFamily],
      });
    }
  }

  const seedTitleTerms = careerProfile.seedTitles.map((value, index) => {
    const match = titleMatches.get(normalizeSearchText(value));
    const title = match?.entity;
    if (title) {
      const sourceReference = match.viaAlias
        ? `taxonomy:alias:${value}:role-title:${title.id}`
        : `taxonomy:title:${title.id}`;
      for (const roleFamilyId of title.roleFamilyIds) {
        addFamilyEvidence(familyEvidence, roleFamilyId, {
          confidence: 1,
          userApproved: false,
          rationale: match.viaAlias
            ? `The seed title "${value}" is a taxonomy alias for "${title.label}".`
            : `The seed title "${value}" matches the taxonomy title "${title.label}".`,
          sourceReference,
          triggeringInputs: [value],
        });
      }
    }
    return makeTerm({
      id: `seed-title-${index + 1}`,
      value,
      type: "title",
      status: "seed",
      source: "user",
      sourceReference: `career-profile.seedTitles.${index}`,
      triggeringInputs: [value],
      rationale: "Provided directly as a career-profile seed title.",
      confidence: 1,
      roleFamilyIds: title?.roleFamilyIds ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  for (const value of careerProfile.skills.primary) {
    const skill = skillMatches.get(normalizeSearchText(value))?.entity;
    if (!skill) continue;
    for (const roleFamilyId of skill.roleFamilyIds) {
      addFamilyEvidence(familyEvidence, roleFamilyId, {
        confidence: 0.78,
        userApproved: false,
        rationale: `The primary skill "${value}" is associated with this role family in the taxonomy.`,
        sourceReference: `taxonomy:skill:${skill.id}`,
        triggeringInputs: [value],
      });
    }
    for (const relation of skill.relatedSkills) {
      if (relation.strength < preferences.queryPlanning.minimumConfidence) {
        continue;
      }
      const relatedSkill = taxonomy.skills.find(
        (candidate) => candidate.id === relation.skillId,
      );
      if (!relatedSkill) continue;
      addCandidate({
        id: `taxonomy-skill-${relatedSkill.id}`,
        value: relatedSkill.label,
        type: "skill",
        status: "proposed",
        source: "taxonomy",
        sourceReference: `taxonomy:skill:${skill.id}:related-skill:${relatedSkill.id}`,
        triggeringInputs: [value],
        rationale: `The taxonomy describes "${relatedSkill.label}" as ${relation.relationship} to "${skill.label}" (strength ${relation.strength.toFixed(2)}).`,
        confidence: relation.strength,
        roleFamilyIds: relatedSkill.roleFamilyIds,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  const secondarySkillTerms = careerProfile.skills.secondary.map(
    (value, index) => {
      const skill = skillMatches.get(normalizeSearchText(value))?.entity;
      if (skill) {
        for (const roleFamilyId of skill.roleFamilyIds) {
          addFamilyEvidence(familyEvidence, roleFamilyId, {
            confidence: 0.66,
            userApproved: false,
            rationale: `The transferable skill "${value}" is associated with this role family in the taxonomy.`,
            sourceReference: `taxonomy:skill:${skill.id}`,
            triggeringInputs: [value],
          });
        }
      }
      return makeTerm({
        id: `seed-transferable-skill-${index + 1}`,
        value,
        type: "skill",
        status: "seed",
        source: "user",
        sourceReference: `career-profile.skills.secondary.${index}`,
        triggeringInputs: [value],
        rationale: "Provided directly as a transferable skill.",
        confidence: 1,
        roleFamilyIds: skill?.roleFamilyIds ?? [],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    },
  );

  const desiredResponsibilityTerms = preferences.desiredResponsibilities.map(
    (value, index) => {
      const responsibility = responsibilityMatches.get(
        normalizeSearchText(value),
      )?.entity;
      if (responsibility) {
        for (const roleFamilyId of responsibility.roleFamilyIds) {
          addFamilyEvidence(familyEvidence, roleFamilyId, {
            confidence: 0.8,
            userApproved: false,
            rationale: `The desired responsibility "${value}" is associated with this role family in the taxonomy.`,
            sourceReference: `taxonomy:responsibility:${responsibility.id}`,
            triggeringInputs: [value],
          });
        }
      }
      return makeTerm({
        id: `seed-responsibility-${index + 1}`,
        value,
        type: "responsibility",
        status: "seed",
        source: "user",
        sourceReference: `search-preferences.desiredResponsibilities.${index}`,
        triggeringInputs: [value],
        rationale: "Added directly as a desired responsibility.",
        confidence: 1,
        roleFamilyIds: responsibility?.roleFamilyIds ?? [],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    },
  );

  const familyRecommendations = recommendRoleFamilies(
    taxonomy.families,
    familyEvidence,
    preferences,
  );
  const approvedRoleFamilyIds = familyRecommendations
    .filter((recommendation) => recommendation.status === "approved")
    .map((recommendation) => recommendation.roleFamilyId);
  const existingTerms = preferences.terms;
  const seedTerms = [
    ...seedTitleTerms,
    ...careerProfile.skills.primary.map((value, index) => {
      const skill = skillMatches.get(normalizeSearchText(value))?.entity;
      return makeTerm({
        id: `seed-primary-skill-${index + 1}`,
        value,
        type: "skill",
        status: "seed",
        source: "user",
        sourceReference: `career-profile.skills.primary.${index}`,
        triggeringInputs: [value],
        rationale: "Provided directly as a primary skill.",
        confidence: 1,
        roleFamilyIds: skill?.roleFamilyIds ?? [],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }),
    ...secondarySkillTerms,
    ...desiredResponsibilityTerms,
    ...preferences.negativeKeywords.map((value, index) =>
      makeTerm({
        id: `seed-negative-${index + 1}`,
        value,
        type: "negative",
        status: "seed",
        source: "user",
        sourceReference: `search-preferences.negativeKeywords.${index}`,
        triggeringInputs: [value],
        rationale: "Added directly as a user exclusion.",
        confidence: 1,
        roleFamilyIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ),
  ];
  const allTerms = mergeTerms(seedTerms, existingTerms);

  if (preferences.queryPlanning.allowTaxonomyExpansion) {
    const titleCandidates = findTitleCandidates(
      taxonomy,
      familyEvidence,
      familyById,
      preferences.queryPlanning.minimumConfidence,
    );
    for (const candidate of titleCandidates) {
      addCandidate({
        id: `taxonomy-title-${candidate.title.id}`,
        value: candidate.title.label,
        type: "title",
        status: "proposed",
        source: "taxonomy",
        sourceReference: `taxonomy:title:${candidate.title.id}`,
        triggeringInputs: candidate.triggeringInputs,
        rationale: candidate.rationale,
        confidence: candidate.confidence,
        roleFamilyIds: candidate.title.roleFamilyIds,
        ...(candidate.driftWarning
          ? { driftWarning: candidate.driftWarning }
          : {}),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    for (const responsibility of taxonomy.responsibilities) {
      const familyEvidenceForResponsibility = responsibility.roleFamilyIds
        .map((familyId) => familyEvidence.get(familyId))
        .filter((evidence): evidence is FamilyEvidence => Boolean(evidence))
        .sort((left, right) => right.confidence - left.confidence)[0];
      if (
        !familyEvidenceForResponsibility ||
        familyEvidenceForResponsibility.confidence <
          preferences.queryPlanning.minimumConfidence
      ) {
        continue;
      }
      for (const [phraseIndex, phrase] of responsibility.phrases.entries()) {
        addCandidate({
          id: `taxonomy-responsibility-${responsibility.id}-${phraseIndex + 1}`,
          value: phrase,
          type: "responsibility",
          status: "proposed",
          source: "taxonomy",
          sourceReference: `taxonomy:responsibility:${responsibility.id}`,
          triggeringInputs: familyEvidenceForResponsibility.triggeringInputs,
          rationale: `The taxonomy associates this phrase with "${responsibility.label}" and role families ${responsibility.roleFamilyIds.join(", ")}; the relationship was triggered by ${familyEvidenceForResponsibility.triggeringInputs.join(", ")}.`,
          confidence: familyEvidenceForResponsibility.confidence,
          roleFamilyIds: responsibility.roleFamilyIds,
          ...(familyEvidenceForResponsibility.driftWarning
            ? {
                driftWarning:
                  familyEvidenceForResponsibility.driftWarning,
              }
            : {}),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }
  }

  const terms = mergeTerms(allTerms, generatedTerms);
  const activeTerms = terms.filter(isActiveTerm);
  const activeResponsibilityTerms = activeTerms.filter(
    (term) => term.type === "responsibility",
  );
  const activeSkillTerms = activeTerms.filter((term) => term.type === "skill");
  const searchProfile = {
    profileId: careerProfile.profileId,
    version: preferences.version,
    taxonomyVersion: taxonomy.taxonomyVersion,
    userInput: {
      name: careerProfile.name,
      targetIdentity: careerProfile.targetIdentity,
      professionalDirection: careerProfile.professionalDirection,
      preferredRoleFamilies: careerProfile.preferredRoleFamilies,
      seedTitles: careerProfile.seedTitles,
      desiredResponsibilities: preferences.desiredResponsibilities,
      primarySkills: careerProfile.skills.primary,
      transferableSkills: careerProfile.skills.secondary,
      negativeKeywords: preferences.negativeKeywords,
    },
    roleFamilies: familyRecommendations,
    terms,
    approvedRoleFamilyIds,
    seedTitles: terms.filter(
      (term) => term.type === "title" && term.status === "seed",
    ),
    approvedTitles: terms.filter(
      (term) => term.type === "title" && term.status === "approved",
    ),
    approvedAdjacentTitles: terms.filter(
      (term) =>
        term.type === "title" &&
        term.status === "approved" &&
        term.source !== "user",
    ),
    proposedTitles: terms.filter(
      (term) => term.type === "title" && term.status === "proposed",
    ),
    rejectedTitles: terms.filter(
      (term) => term.type === "title" && term.status === "rejected",
    ),
    deferredTitles: terms.filter(
      (term) => term.type === "title" && term.status === "deferred",
    ),
    responsibilities: activeResponsibilityTerms,
    proposedResponsibilities: terms.filter(
      (term) =>
        term.type === "responsibility" && term.status === "proposed",
    ),
    primarySkills: careerProfile.skills.primary,
    transferableSkills: [
      ...careerProfile.skills.secondary,
      ...activeSkillTerms
        .filter((term) => term.status === "approved")
        .map((term) => term.value),
    ],
    proposedSkills: terms.filter(
      (term) => term.type === "skill" && term.status === "proposed",
    ),
    negativeKeywords: uniqueStrings([
      ...preferences.negativeKeywords,
      ...terms
        .filter((term) => term.type === "negative" && isActiveTerm(term))
        .map((term) => term.value),
    ]),
    preferredIndustries: preferences.preferredIndustries,
    excludedIndustries: preferences.excludedIndustries,
    seniorityPreferences: preferences.seniorityPreferences,
    locationRules: {
      preferredLocations:
        preferences.locationRules.preferredLocations.length > 0
          ? preferences.locationRules.preferredLocations
          : [
              {
                city: careerProfile.locations.homeBase.city,
                region: careerProfile.locations.homeBase.region,
                postalCode: careerProfile.locations.homeBase.postalCode,
              },
              ...careerProfile.locations.additionalLocations.map(
                ({ city, region, postalCode }) => ({
                  city,
                  region,
                  postalCode,
                }),
              ),
            ],
      excludedLocations: preferences.locationRules.excludedLocations,
      willingToRelocate:
        preferences.locationRules.willingToRelocate ??
        careerProfile.locations.willingToRelocate,
    },
    compensationRules:
      Object.keys(preferences.compensationRules).length > 0
        ? preferences.compensationRules
        : careerProfile.compensation,
    workArrangement: {
      preferredModes:
        preferences.workArrangement.preferredModes.length > 0
          ? preferences.workArrangement.preferredModes
          : careerProfile.locations.workModes,
    },
    workAuthorization: preferences.workAuthorization,
    sourcePreferences: preferences.sourcePreferences,
    queryPlanning: preferences.queryPlanning,
  };
  return SearchProfileSchema.parse(searchProfile);
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function indexRoleFamilies(
  families: RoleFamily[],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const family of families) {
    index.set(normalizeSearchText(family.id), family.id);
    index.set(normalizeSearchText(family.label), family.id);
  }
  return index;
}

function indexEntities<T extends { id: string; label: string }>(
  entities: T[],
  aliases: TaxonomyAlias[],
  entityType: TaxonomyAlias["entityType"],
  getAdditionalAliases: (entity: T) => string[] = () => [],
): Map<string, { entity: T; viaAlias: boolean }> {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const index = new Map<string, { entity: T; viaAlias: boolean }>();
  for (const entity of entities) {
    index.set(normalizeSearchText(entity.id), { entity, viaAlias: false });
    index.set(normalizeSearchText(entity.label), { entity, viaAlias: false });
    for (const alias of getAdditionalAliases(entity)) {
      const key = normalizeSearchText(alias);
      const existing = index.get(key);
      if (existing && existing.entity.id !== entity.id) {
        throw new Error(
          `Ambiguous ${entityType} phrase "${alias}" maps to multiple taxonomy entities.`,
        );
      }
      index.set(key, { entity, viaAlias: true });
    }
  }
  for (const alias of aliases) {
    if (alias.entityType !== entityType) continue;
    const entity = byId.get(alias.entityId);
    if (!entity) continue;
    const key = normalizeSearchText(alias.value);
    const existing = index.get(key);
    if (existing && existing.entity.id !== entity.id) {
      throw new Error(
        `Ambiguous ${entityType} alias "${alias.value}" maps to multiple taxonomy entities.`,
      );
    }
    index.set(key, { entity, viaAlias: true });
  }
  return index;
}

function addFamilyEvidence(
  evidence: Map<string, FamilyEvidence>,
  familyId: string,
  candidate: FamilyEvidence,
): void {
  const existing = evidence.get(familyId);
  if (!existing || candidate.confidence > existing.confidence) {
    evidence.set(familyId, candidate);
  } else if (
    candidate.confidence === existing.confidence &&
    candidate.triggeringInputs.join("\u0000") !==
      existing.triggeringInputs.join("\u0000")
  ) {
    evidence.set(familyId, {
      ...existing,
      userApproved: existing.userApproved || candidate.userApproved,
      triggeringInputs: uniqueStrings([
        ...existing.triggeringInputs,
        ...candidate.triggeringInputs,
      ]),
    });
  } else if (candidate.userApproved && !existing.userApproved) {
    evidence.set(familyId, { ...existing, userApproved: true });
  }
}

function recommendRoleFamilies(
  families: RoleFamily[],
  evidence: Map<string, FamilyEvidence>,
  preferences: SearchPreferences,
): RoleFamilyRecommendation[] {
  const decisions = new Map(
    preferences.roleFamilyDecisions.map((decision) => [
      decision.roleFamilyId,
      decision,
    ]),
  );
  const output = new Map<string, RoleFamilyRecommendation>();
  for (const family of families) {
    const decision = decisions.get(family.id);
    const supportingEvidence = evidence.get(family.id);
    if (!decision && !supportingEvidence) continue;
      const defaultStatus = supportingEvidence?.userApproved
        ? "approved"
        : "proposed";
    const status = decision?.status ?? defaultStatus;
    const confidence =
      supportingEvidence?.confidence ??
      (decision?.status === "approved" ? 1 : 0.5);
    output.set(family.id, {
      roleFamilyId: family.id,
      label: family.label,
      status,
      rationale:
        decision?.rationale ??
        supportingEvidence?.rationale ??
        "Manually selected by the user.",
      sourceReference:
        supportingEvidence?.sourceReference ??
        "search-preferences.roleFamilyDecisions",
      triggeringInputs: supportingEvidence?.triggeringInputs ?? [],
      confidence,
      ...(supportingEvidence?.driftWarning
        ? { driftWarning: supportingEvidence.driftWarning }
        : {}),
    });
  }
  for (const family of families) {
    const source = evidence.get(family.id);
    if (!source) continue;
    for (const relation of family.relatedFamilies) {
      const confidence = source.confidence * relation.strength;
      if (confidence < preferences.queryPlanning.minimumConfidence) continue;
      const relatedFamily = families.find(
        (candidate) => candidate.id === relation.familyId,
      );
      if (!relatedFamily) continue;
      const decision = decisions.get(relatedFamily.id);
      const existing = output.get(relatedFamily.id);
      const proposal: RoleFamilyRecommendation = {
        roleFamilyId: relatedFamily.id,
        label: relatedFamily.label,
        status: decision?.status ?? "proposed",
        rationale:
          decision?.rationale ??
          `"${relatedFamily.label}" is ${relation.relationship} to "${family.label}" in the taxonomy (strength ${relation.strength.toFixed(2)}).`,
        sourceReference: `taxonomy:role-family:${family.id}:${relation.relationship}:${relatedFamily.id}`,
        triggeringInputs: source.triggeringInputs,
        confidence,
        ...(relation.relationship === "adjacent"
          ? {
              driftWarning: `Adjacent role family; confirm this direction before including it in active searches.`,
            }
          : {}),
      };
      if (!existing || proposal.confidence > existing.confidence) {
        output.set(relatedFamily.id, proposal);
      } else if (decision && existing.status !== decision.status) {
        output.set(relatedFamily.id, {
          ...existing,
          status: decision.status,
          rationale: decision.rationale,
        });
      }
    }
  }
  return [...output.values()].sort((left, right) =>
    left.roleFamilyId.localeCompare(right.roleFamilyId),
  );
}

function findTitleCandidates(
  taxonomy: RoleTaxonomy,
  familyEvidence: Map<string, FamilyEvidence>,
  familiesById: Map<string, RoleFamily>,
  minimumConfidence: number,
): TitleCandidate[] {
  const candidates: TitleCandidate[] = [];
  for (const title of taxonomy.titles) {
    const evidenceCandidates: Array<
      FamilyEvidence & {
        relation: "direct" | RoleFamily["relatedFamilies"][number]["relationship"];
        sourceFamilyId: string;
        targetFamilyId: string;
        relationshipStrength: number;
      }
    > = [];
    for (const familyId of title.roleFamilyIds) {
      const direct = familyEvidence.get(familyId);
      if (direct) {
        evidenceCandidates.push({
          ...direct,
          relation: "direct",
          sourceFamilyId: familyId,
          targetFamilyId: familyId,
          relationshipStrength: 1,
        });
        continue;
      }
      for (const [sourceId, source] of familyEvidence) {
        const family = familiesById.get(sourceId);
        const relation = family?.relatedFamilies.find(
          (item) => item.familyId === familyId,
        );
        if (relation) {
          evidenceCandidates.push({
            ...source,
            confidence: source.confidence * relation.strength,
            relation: relation.relationship,
            sourceFamilyId: sourceId,
            targetFamilyId: familyId,
            relationshipStrength: relation.strength,
          });
        }
      }
    }
    const evidence = evidenceCandidates.sort(
      (left, right) => right.confidence - left.confidence,
    )[0];
    if (!evidence || evidence.confidence < minimumConfidence) continue;
    const driftWarning =
      evidence.relation === "adjacent"
        ? `Adjacent role family; review for role drift from the stated career direction.`
        : undefined;
    candidates.push({
      title,
      confidence: evidence.confidence,
      rationale:
        evidence.relation === "direct"
          ? `The taxonomy maps this title to "${familiesById.get(evidence.targetFamilyId)?.label ?? evidence.targetFamilyId}", based on ${evidence.triggeringInputs.join(", ")}.`
          : `The taxonomy relates "${familiesById.get(evidence.sourceFamilyId)?.label ?? evidence.sourceFamilyId}" to "${familiesById.get(evidence.targetFamilyId)?.label ?? evidence.targetFamilyId}" as ${evidence.relation} (strength ${evidence.relationshipStrength.toFixed(2)}), based on ${evidence.triggeringInputs.join(", ")}.`,
      triggeringInputs: evidence.triggeringInputs,
      ...(driftWarning ? { driftWarning } : {}),
    });
  }
  return candidates.sort((left, right) =>
    left.title.id.localeCompare(right.title.id),
  );
}

function makeTerm(value: SearchTerm): SearchTerm {
  return SearchTermSchema.parse(value);
}

function mergeTerms(...termGroups: SearchTerm[][]): SearchTerm[] {
  const byKey = new Map<string, SearchTerm>();
  for (const term of termGroups.flat()) {
    const key = `${term.type}:${normalizeSearchText(term.value)}`;
    if (!byKey.has(key)) {
      byKey.set(key, term);
    } else if (term.status === "seed") {
      const existing = byKey.get(key);
      if (existing?.status !== "seed") {
        byKey.set(key, term);
      }
    }
  }
  return [...byKey.values()];
}

function isActiveTerm(term: SearchTerm): boolean {
  return term.status === "seed" || term.status === "approved";
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeSearchText(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validatePreferenceReferences(
  preferences: SearchPreferences,
  taxonomy: RoleTaxonomy,
): void {
  const familyIds = new Set(taxonomy.families.map((family) => family.id));
  const industryIds = new Set(taxonomy.industries.map((industry) => industry.id));
  const references = [
    ...preferences.roleFamilyDecisions.map((item) => item.roleFamilyId),
    ...preferences.terms.flatMap((term) => term.roleFamilyIds),
  ];
  for (const familyId of references) {
    if (!familyIds.has(familyId)) {
      throw new Error(`Search preferences reference unknown role family "${familyId}".`);
    }
  }
  for (const industryId of [
    ...preferences.preferredIndustries,
    ...preferences.excludedIndustries,
  ]) {
    if (!industryIds.has(industryId)) {
      throw new Error(`Search preferences reference unknown industry "${industryId}".`);
    }
  }
}
