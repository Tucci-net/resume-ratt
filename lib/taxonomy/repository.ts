import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";
import { parseDocument } from "yaml";
import {
  AliasDocumentSchema,
  IndustryDocumentSchema,
  ResponsibilityDocumentSchema,
  RoleFamilyDocumentSchema,
  RoleTaxonomySchema,
  RoleTitleDocumentSchema,
  SkillDocumentSchema,
  validateTaxonomyReferences,
} from "./model";
import type { RoleTaxonomy } from "./model";

export class YamlRoleTaxonomyRepository {
  constructor(
    private readonly taxonomyDirectory = path.join(
      process.cwd(),
      "data",
      "taxonomy",
    ),
  ) {}

  async load(locale = "en-US"): Promise<RoleTaxonomy> {
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
      throw new Error(`Unsupported taxonomy locale: ${locale}`);
    }
    const directory = path.join(this.taxonomyDirectory, locale);
    const [
      familyDocument,
      titleDocument,
      skillDocument,
      responsibilityDocument,
      aliasDocument,
      industryDocument,
    ] = await Promise.all([
      this.readDocument(
        path.join(directory, "role-families.yaml"),
        RoleFamilyDocumentSchema,
      ),
      this.readDocument(path.join(directory, "titles.yaml"), RoleTitleDocumentSchema),
      this.readDocument(path.join(directory, "skills.yaml"), SkillDocumentSchema),
      this.readDocument(
        path.join(directory, "responsibilities.yaml"),
        ResponsibilityDocumentSchema,
      ),
      this.readDocument(path.join(directory, "aliases.yaml"), AliasDocumentSchema),
      this.readDocument(
        path.join(directory, "industries.yaml"),
        IndustryDocumentSchema,
      ),
    ]);

    const documents = [
      familyDocument,
      titleDocument,
      skillDocument,
      responsibilityDocument,
      aliasDocument,
      industryDocument,
    ];
    for (const document of documents) {
      if (
        document.locale !== locale ||
        document.taxonomyVersion !== familyDocument.taxonomyVersion
      ) {
        throw new Error(
          "Taxonomy files must use the requested locale and the same taxonomy version.",
        );
      }
    }

    const taxonomy = RoleTaxonomySchema.parse({
      schemaVersion: familyDocument.schemaVersion,
      taxonomyVersion: familyDocument.taxonomyVersion,
      locale,
      families: familyDocument.families,
      titles: titleDocument.titles,
      skills: skillDocument.skills,
      responsibilities: responsibilityDocument.responsibilities,
      aliases: aliasDocument.aliases,
      industries: industryDocument.industries,
    });
    validateTaxonomyReferences(taxonomy);
    return taxonomy;
  }

  private async readDocument<
    T extends { locale: string; taxonomyVersion: string },
  >(
    filePath: string,
    schema: ZodType<T>,
  ): Promise<T & { locale: string; taxonomyVersion: string }> {
    const input = await readFile(filePath, "utf8");
    const document = parseDocument(input, { uniqueKeys: true });
    if (document.errors.length > 0) {
      throw new Error(
        `Invalid taxonomy YAML in ${path.basename(filePath)}: ${document.errors
          .map((error) => error.message)
          .join(" ")}`,
      );
    }
    let value: unknown;
    try {
      value = document.toJS({ maxAliasCount: 0 });
    } catch (error) {
      throw new Error(
        `Could not read taxonomy YAML in ${path.basename(filePath)}: ${
          error instanceof Error ? error.message : "unknown YAML error"
        }`,
      );
    }
    return schema.parse(value);
  }
}
