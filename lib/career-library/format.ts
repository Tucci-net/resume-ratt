import type {
  CareerLibraryDocument,
  CareerLibraryItem,
  CareerLibraryItemType,
  CareerLibraryVariant,
  CareerLibraryVerificationStatus,
} from "@/lib/resume/model";
import { z } from "zod";

const ITEM_TYPES = new Set<CareerLibraryItemType>([
  "accomplishment",
  "experience",
  "project",
  "skill",
  "summary",
  "education",
  "certification",
]);
const VERIFICATION_STATUSES = new Set<CareerLibraryVerificationStatus>([
  "unverified",
  "self-verified",
  "verified",
]);
const MARKDOWN_DOCUMENT_SEPARATOR = "\n\n<!-- career-library-item -->\n\n";
const variantSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  status: z.enum(["proposed", "approved", "rejected"]),
  sourceDraftId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export function serializeCareerLibraryJson(
  items: CareerLibraryItem[],
): string {
  const validatedItems = items.map((item, index) =>
    validateCareerLibraryItem(item, `items[${index}]`),
  );
  assertUniqueIds(validatedItems);
  const document: CareerLibraryDocument = {
    version: 1,
    items: validatedItems,
  };
  return JSON.stringify(document, null, 2);
}

export function parseCareerLibraryJson(input: string): CareerLibraryItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("The career library file is not valid JSON.");
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.items)
  ) {
    throw new Error("The career library JSON must have version 1 and an items array.");
  }

  const items = parsed.items.map((item, index) =>
    validateCareerLibraryItem(item, `items[${index}]`),
  );
  assertUniqueIds(items);
  return items;
}

export function serializeCareerLibraryMarkdown(
  items: CareerLibraryItem[],
): string {
  assertUniqueIds(items);
  return items
    .map((item) => {
      validateCareerLibraryItem(item, "career library item");
      const frontMatter = [
        `id: ${yamlString(item.id)}`,
        `type: ${item.type}`,
        ...(item.canonicalRevisionId
          ? [`canonicalRevisionId: ${yamlString(item.canonicalRevisionId)}`]
          : []),
        `tags: ${yamlArray(item.tags)}`,
        `skills: ${yamlArray(item.skills)}`,
        `metrics: ${yamlArray(item.metrics)}`,
        ...(item.restricted ? ["restricted: true"] : []),
        ...(item.source === undefined
          ? []
          : [`source: ${yamlString(item.source)}`]),
        `verificationStatus: ${item.verificationStatus}`,
        `createdAt: ${yamlString(item.createdAt)}`,
        `updatedAt: ${yamlString(item.updatedAt)}`,
        ...(item.variants
          ? [`variants: ${yamlString(JSON.stringify(item.variants))}`]
          : []),
      ].join("\n");

      return `---\n${frontMatter}\n---\n\n${item.canonicalText.trim()}`;
    })
    .join(MARKDOWN_DOCUMENT_SEPARATOR);
}

export function parseCareerLibraryMarkdown(
  input: string,
): CareerLibraryItem[] {
  if (!input.trim()) return [];

  const documents = input
    .split(MARKDOWN_DOCUMENT_SEPARATOR)
    .map((document) => document.trim())
    .filter(Boolean);
  const items = documents.map((document, index) =>
    parseMarkdownItem(document, index),
  );
  assertUniqueIds(items);
  return items;
}

function parseMarkdownItem(document: string, index: number): CareerLibraryItem {
  const lines = document.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new Error(`Markdown item ${index + 1} is missing YAML front matter.`);
  }

  const closingIndex = lines.findIndex(
    (line, lineIndex) => lineIndex > 0 && line.trim() === "---",
  );
  if (closingIndex < 0) {
    throw new Error(`Markdown item ${index + 1} has unterminated front matter.`);
  }

  const metadata = parseFrontMatter(lines.slice(1, closingIndex));
  const canonicalText = lines.slice(closingIndex + 1).join("\n").trim();
  return validateCareerLibraryItem(
    {
      ...metadata,
      canonicalText,
    },
    `Markdown item ${index + 1}`,
  );
}

function parseFrontMatter(lines: string[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = /^([A-Za-z][\w-]*):(?:\s*(.*))?$/.exec(line);
    if (!match) {
      throw new Error(`Unsupported YAML front matter line: ${line}`);
    }

    const [, key, rawValue = ""] = match;
    if (Object.hasOwn(values, key!)) {
      throw new Error(`Duplicate YAML front matter field: ${key}`);
    }

    if (rawValue.trim()) {
      values[key!] = parseYamlValue(rawValue.trim());
      continue;
    }

    const list: unknown[] = [];
    while (
      index + 1 < lines.length &&
      /^\s+-\s+/.test(lines[index + 1]!)
    ) {
      index += 1;
      list.push(parseYamlValue(lines[index]!.replace(/^\s+-\s+/, "")));
    }
    values[key!] =
      list.length > 0
        ? list
        : ["tags", "skills", "metrics"].includes(key!)
          ? []
          : "";
  }

  return values;
}

function parseYamlValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(`Invalid quoted YAML value: ${value}`);
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) {
      throw new Error(`Invalid quoted YAML value: ${value}`);
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      const contents = value.slice(1, -1).trim();
      if (!contents) return [];
      return splitYamlFlowValues(contents).map(parseYamlValue);
    }
  }
  return value;
}

function splitYamlFlowValues(value: string): string[] {
  const values: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote === '"') {
      current += character;
      escaped = true;
      continue;
    }
    if ((character === "'" || character === '"') && !quote) {
      quote = character;
    } else if (character === quote) {
      quote = null;
    }
    if (character === "," && !quote) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  if (quote) throw new Error(`Invalid YAML array: [${value}]`);
  values.push(current.trim());
  return values;
}

function validateCareerLibraryItem(
  value: unknown,
  label: string,
): CareerLibraryItem {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const item: CareerLibraryItem = {
    id: requiredString(value.id, `${label}.id`),
    type: requiredEnum(value.type, ITEM_TYPES, `${label}.type`),
    canonicalText: requiredString(
      value.canonicalText,
      `${label}.canonicalText`,
    ),
    tags: stringArray(value.tags, `${label}.tags`),
    skills: stringArray(value.skills, `${label}.skills`),
    metrics: stringArray(value.metrics, `${label}.metrics`),
    verificationStatus: requiredEnum(
      value.verificationStatus,
      VERIFICATION_STATUSES,
      `${label}.verificationStatus`,
    ),
    createdAt: requiredTimestamp(value.createdAt, `${label}.createdAt`),
    updatedAt: requiredTimestamp(value.updatedAt, `${label}.updatedAt`),
  };

  if (value.canonicalRevisionId !== undefined) {
    item.canonicalRevisionId = requiredString(
      value.canonicalRevisionId,
      `${label}.canonicalRevisionId`,
    );
  }
  if (value.restricted !== undefined) {
    if (typeof value.restricted !== "boolean") {
      throw new Error(`${label}.restricted must be a boolean.`);
    }
    item.restricted = value.restricted;
  }
  if (value.variants !== undefined) {
    let variants: unknown = value.variants;
    if (typeof variants === "string") {
      try {
        variants = JSON.parse(variants) as unknown;
      } catch {
        throw new Error(`${label}.variants must be valid JSON.`);
      }
    }
    const parsedVariants = z.array(variantSchema).safeParse(variants);
    if (!parsedVariants.success) {
      throw new Error(`${label}.variants has an invalid variant.`);
    }
    item.variants = parsedVariants.data as CareerLibraryVariant[];
  }
  if (value.source !== undefined && value.source !== "") {
    item.source = requiredString(value.source, `${label}.source`);
  }
  if (!item.canonicalText.trim()) {
    throw new Error(`${label}.canonicalText cannot be empty.`);
  }
  return item;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return value;
}

function requiredEnum<T extends string>(
  value: unknown,
  values: Set<T>,
  label: string,
): T {
  if (typeof value !== "string" || !values.has(value as T)) {
    throw new Error(`${label} has an unsupported value.`);
  }
  return value as T;
}

function requiredTimestamp(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(`${label} must be an ISO 8601 timestamp.`);
  }
  return value;
}

function assertUniqueIds(items: CareerLibraryItem[]): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate career library item ID: ${item.id}`);
    }
    ids.add(item.id);
  }
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function yamlArray(values: string[]): string {
  return JSON.stringify(values);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
