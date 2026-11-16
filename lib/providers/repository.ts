import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";
import { ProviderCatalogSchema } from "./model";
import type { ProviderCatalog } from "./model";
import type { RoleTaxonomy } from "@/lib/taxonomy/model";
import { validateProviderCatalog } from "./model";

export class YamlProviderCatalogRepository {
  constructor(
    private readonly catalogPath = path.join(
      process.cwd(),
      "data",
      "providers",
      "catalog.yaml",
    ),
  ) {}

  async load(taxonomy: RoleTaxonomy): Promise<ProviderCatalog> {
    const input = await readFile(this.catalogPath, "utf8");
    const document = parseDocument(input, { uniqueKeys: true });
    if (document.errors.length > 0) {
      throw new Error(
        `Invalid provider catalog YAML: ${document.errors
          .map((error) => error.message)
          .join(" ")}`,
      );
    }

    let value: unknown;
    try {
      value = document.toJS({ maxAliasCount: 0 });
    } catch (error) {
      throw new Error(
        `Could not read provider catalog YAML: ${
          error instanceof Error ? error.message : "unknown YAML error"
        }`,
      );
    }
    const catalog = ProviderCatalogSchema.parse(value);
    validateProviderCatalog(catalog, taxonomy);
    return catalog;
  }
}
