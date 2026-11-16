import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const TaxonomyMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  taxonomyVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
});

export const RoleFamilySchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  relatedFamilies: z.array(
    z.object({
      familyId: idSchema,
      relationship: z.enum(["overlaps", "adjacent", "specializes-in"]),
      strength: z.number().min(0).max(1),
    }),
  ),
});

export const RoleTitleSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  roleFamilyIds: z.array(idSchema).min(1),
  responsibilityIds: z.array(idSchema),
  skillIds: z.array(idSchema),
});

export const TaxonomySkillSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  roleFamilyIds: z.array(idSchema),
  relatedSkills: z.array(
    z.object({
      skillId: idSchema,
      relationship: z.enum(["complements", "specializes-in", "overlaps"]),
      strength: z.number().min(0).max(1),
    }),
  ),
});

export const ResponsibilitySchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  phrases: z.array(z.string().trim().min(1)),
  roleFamilyIds: z.array(idSchema),
  skillIds: z.array(idSchema),
});

export const TaxonomyAliasSchema = z.object({
  value: z.string().trim().min(1),
  entityType: z.enum(["role-title", "skill", "responsibility", "industry"]),
  entityId: idSchema,
});

export const IndustrySchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  relatedIndustryIds: z.array(idSchema),
});

export const RoleFamilyDocumentSchema = TaxonomyMetadataSchema.extend({
  families: z.array(RoleFamilySchema),
});

export const RoleTitleDocumentSchema = TaxonomyMetadataSchema.extend({
  titles: z.array(RoleTitleSchema),
});

export const SkillDocumentSchema = TaxonomyMetadataSchema.extend({
  skills: z.array(TaxonomySkillSchema),
});

export const ResponsibilityDocumentSchema = TaxonomyMetadataSchema.extend({
  responsibilities: z.array(ResponsibilitySchema),
});

export const AliasDocumentSchema = TaxonomyMetadataSchema.extend({
  aliases: z.array(TaxonomyAliasSchema),
});

export const IndustryDocumentSchema = TaxonomyMetadataSchema.extend({
  industries: z.array(IndustrySchema),
});

export const RoleTaxonomySchema = TaxonomyMetadataSchema.extend({
  families: z.array(RoleFamilySchema),
  titles: z.array(RoleTitleSchema),
  skills: z.array(TaxonomySkillSchema),
  responsibilities: z.array(ResponsibilitySchema),
  aliases: z.array(TaxonomyAliasSchema),
  industries: z.array(IndustrySchema),
});

export type RoleFamily = z.infer<typeof RoleFamilySchema>;
export type RoleTitle = z.infer<typeof RoleTitleSchema>;
export type TaxonomySkill = z.infer<typeof TaxonomySkillSchema>;
export type Responsibility = z.infer<typeof ResponsibilitySchema>;
export type TaxonomyAlias = z.infer<typeof TaxonomyAliasSchema>;
export type Industry = z.infer<typeof IndustrySchema>;
export type RoleTaxonomy = z.infer<typeof RoleTaxonomySchema>;

export function validateTaxonomyReferences(taxonomy: RoleTaxonomy): void {
  const familyIds = uniqueIds(taxonomy.families, "role family");
  const titleIds = uniqueIds(taxonomy.titles, "role title");
  const skillIds = uniqueIds(taxonomy.skills, "skill");
  const responsibilityIds = uniqueIds(
    taxonomy.responsibilities,
    "responsibility",
  );
  const industryIds = uniqueIds(taxonomy.industries, "industry");

  for (const family of taxonomy.families) {
    for (const relation of family.relatedFamilies) {
      requireReference(familyIds, relation.familyId, `${family.id}.relatedFamilies`);
    }
  }
  for (const title of taxonomy.titles) {
    requireReferences(familyIds, title.roleFamilyIds, `${title.id}.roleFamilyIds`);
    requireReferences(
      responsibilityIds,
      title.responsibilityIds,
      `${title.id}.responsibilityIds`,
    );
    requireReferences(skillIds, title.skillIds, `${title.id}.skillIds`);
  }
  for (const skill of taxonomy.skills) {
    requireReferences(familyIds, skill.roleFamilyIds, `${skill.id}.roleFamilyIds`);
    for (const relation of skill.relatedSkills) {
      requireReference(skillIds, relation.skillId, `${skill.id}.relatedSkills`);
    }
  }
  for (const responsibility of taxonomy.responsibilities) {
    requireReferences(
      familyIds,
      responsibility.roleFamilyIds,
      `${responsibility.id}.roleFamilyIds`,
    );
    requireReferences(
      skillIds,
      responsibility.skillIds,
      `${responsibility.id}.skillIds`,
    );
  }
  for (const industry of taxonomy.industries) {
    requireReferences(
      industryIds,
      industry.relatedIndustryIds,
      `${industry.id}.relatedIndustryIds`,
    );
  }
  for (const alias of taxonomy.aliases) {
    const targetIds = {
      "role-title": titleIds,
      skill: skillIds,
      responsibility: responsibilityIds,
      industry: industryIds,
    }[alias.entityType];
    requireReference(targetIds, alias.entityId, `alias "${alias.value}"`);
  }
  validateAliasUniqueness(taxonomy);
}

function validateAliasUniqueness(taxonomy: RoleTaxonomy): void {
  const namesByType = new Map<string, Map<string, string>>();
  function register(entityType: string, value: string, entityId: string): void {
    const names = namesByType.get(entityType) ?? new Map<string, string>();
    const normalized = normalizeTaxonomyTerm(value);
    const existingId = names.get(normalized);
    if (existingId && existingId !== entityId) {
      throw new Error(
        `Ambiguous ${entityType} term "${value}" maps to both "${existingId}" and "${entityId}".`,
      );
    }
    names.set(normalized, entityId);
    namesByType.set(entityType, names);
  }

  for (const title of taxonomy.titles) {
    register("role-title", title.id, title.id);
    register("role-title", title.label, title.id);
  }
  for (const skill of taxonomy.skills) {
    register("skill", skill.id, skill.id);
    register("skill", skill.label, skill.id);
  }
  for (const responsibility of taxonomy.responsibilities) {
    register("responsibility", responsibility.id, responsibility.id);
    register("responsibility", responsibility.label, responsibility.id);
    for (const phrase of responsibility.phrases) {
      register("responsibility", phrase, responsibility.id);
    }
  }
  for (const industry of taxonomy.industries) {
    register("industry", industry.id, industry.id);
    register("industry", industry.label, industry.id);
  }
  for (const alias of taxonomy.aliases) {
    register(alias.entityType, alias.value, alias.entityId);
  }
}

function normalizeTaxonomyTerm(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueIds<T extends { id: string }>(
  entities: T[],
  entityLabel: string,
): Set<string> {
  const ids = new Set<string>();
  for (const entity of entities) {
    if (ids.has(entity.id)) {
      throw new Error(`Duplicate ${entityLabel} ID: ${entity.id}`);
    }
    ids.add(entity.id);
  }
  return ids;
}

function requireReferences(
  knownIds: Set<string>,
  references: string[],
  label: string,
): void {
  references.forEach((reference) => requireReference(knownIds, reference, label));
}

function requireReference(
  knownIds: Set<string>,
  reference: string,
  label: string,
): void {
  if (!knownIds.has(reference)) {
    throw new Error(`${label} references unknown ID "${reference}".`);
  }
}
