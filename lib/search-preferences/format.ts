import { parseDocument, stringify } from "yaml";
import { SearchPreferencesSchema } from "./model";
import type { SearchPreferences } from "./model";

export function parseSearchPreferencesMarkdown(
  input: string,
): SearchPreferences {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new Error("Search preferences are missing YAML front matter.");
  }
  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (closingIndex < 0) {
    throw new Error("Search preferences have unterminated YAML front matter.");
  }
  const document = parseDocument(lines.slice(1, closingIndex).join("\n"), {
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `Search preferences YAML is invalid: ${document.errors
        .map((error) => error.message)
        .join(" ")}`,
    );
  }
  let frontMatter: unknown;
  try {
    frontMatter = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new Error(
      `Search preferences YAML could not be read: ${
        error instanceof Error ? error.message : "unknown YAML error"
      }`,
    );
  }
  return SearchPreferencesSchema.parse(frontMatter);
}

export function serializeSearchPreferencesMarkdown(
  preferences: SearchPreferences,
): string {
  const validatedPreferences = SearchPreferencesSchema.parse(preferences);
  return `---\n${stringify(validatedPreferences, { lineWidth: 0 }).trimEnd()}\n---\n\nSearch decisions are stored separately from career identity data.\n`;
}
