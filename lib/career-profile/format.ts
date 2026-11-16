import { parseDocument, stringify } from "yaml";
import { CareerProfileSchema } from "./model";
import type { CareerProfile } from "./model";

export function parseCareerProfileMarkdown(input: string): CareerProfile {
  const normalized = input.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new Error("Career profile is missing YAML front matter.");
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (closingIndex < 0) {
    throw new Error("Career profile has unterminated YAML front matter.");
  }

  const document = parseDocument(lines.slice(1, closingIndex).join("\n"), {
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `Career profile YAML is invalid: ${document.errors
        .map((error) => error.message)
        .join(" ")}`,
    );
  }

  let frontMatter: unknown;
  try {
    frontMatter = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new Error(
      `Career profile YAML could not be read: ${
        error instanceof Error ? error.message : "unknown YAML error"
      }`,
    );
  }

  if (
    typeof frontMatter !== "object" ||
    frontMatter === null ||
    Array.isArray(frontMatter)
  ) {
    throw new Error("Career profile YAML front matter must be an object.");
  }

  const validation = CareerProfileSchema.safeParse({
    ...frontMatter,
    professionalDirection: lines.slice(closingIndex + 1).join("\n").trim(),
  });
  if (!validation.success) {
    throw new Error(
      `Career profile is invalid: ${validation.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return validation.data;
}

export function serializeCareerProfileMarkdown(
  profile: CareerProfile,
): string {
  const validatedProfile = CareerProfileSchema.parse(profile);
  const { professionalDirection, ...frontMatter } = validatedProfile;
  return `---\n${stringify(frontMatter, { lineWidth: 0 }).trimEnd()}\n---\n\n${
    professionalDirection.trim()
  }\n`;
}
