import type { CareerLibraryItemType } from "@/lib/resume/model";

export type ResumeImportCandidate = {
  id: string;
  type: CareerLibraryItemType | "contact";
  section: string;
  text: string;
  restricted: boolean;
};

const SECTION_TYPES: Record<string, CareerLibraryItemType> = {
  summary: "summary",
  profile: "summary",
  objective: "summary",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  employment: "experience",
  "employment history": "experience",
  work: "experience",
  "work history": "experience",
  education: "education",
  projects: "project",
  skills: "skill",
  competencies: "skill",
  certifications: "certification",
  certificates: "certification",
};

export function parseResumeText(input: string): ResumeImportCandidate[] {
  const sections: Array<{ title: string; type: CareerLibraryItemType; lines: string[] }> = [];
  let current: (typeof sections)[number] | undefined;

  for (const rawLine of input.replace(/\r\n/g, "\n").split("\n")) {
    const heading = normalizeHeading(rawLine);
    const type = SECTION_TYPES[heading.toLowerCase().replace(/:$/, "")];
    if (type) {
      current = { title: heading, type, lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(rawLine);
    }
  }

  return sections.flatMap(({ title, type, lines }) => {
    if (!lines.some((line) => line.trim())) return [];

    const chunks =
      type === "summary" || type === "skill"
        ? [
            lines
              .map((line) => line.trim())
              .filter(Boolean)
              .join(type === "skill" ? ", " : " "),
          ]
        : groupLines(lines);

    return chunks.map((text) => ({
      id: createId(),
      type,
      section: title,
      text,
      restricted: false,
    }));
  });
}

export function parseResumeMarkdown(input: string): ResumeImportCandidate[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const sectionIndex = lines.findIndex((line) => sectionTypeFor(line) !== null);
  const headerLines = sectionIndex < 0 ? lines : lines.slice(0, sectionIndex);
  const bodyLines = sectionIndex < 0 ? [] : lines.slice(sectionIndex);
  const candidates = parseResumeText(bodyLines.join("\n"));
  const contact = parseMarkdownContact(headerLines);
  return contact ? [contact, ...candidates] : candidates;
}

export function parseResumeJson(input: string): ResumeImportCandidate[] {
  let value: unknown;
  try {
    value = JSON.parse(input) as unknown;
  } catch {
    throw new Error("The résumé JSON file is not valid JSON.");
  }

  if (!isRecord(value)) {
    throw new Error("The résumé JSON must contain an object.");
  }

  const sectionKeys: Array<[string, string[], boolean]> = [
    ["summary", ["summary", "profile", "objective"], false],
    [
      "experience",
      ["experience", "employment", "workExperience", "work_history"],
      true,
    ],
    ["education", ["education"], true],
    ["projects", ["projects"], true],
    ["skills", ["skills", "competencies"], false],
    ["certifications", ["certifications", "certificates"], true],
  ];
  const candidates: ResumeImportCandidate[] = [];

  for (const [heading, keys, splitCollection] of sectionKeys) {
    const key = keys.find((candidate) => Object.hasOwn(value, candidate));
    if (!key) continue;
    const sectionValue = value[key];
    const values =
      splitCollection && Array.isArray(sectionValue)
        ? sectionValue
        : [sectionValue];
    for (const entry of values) {
      const text = flattenValue(entry).join("\n\n");
      if (!text.trim()) continue;
      candidates.push(
        ...parseResumeText(`${heading}\n${text}`).map((candidate) => ({
          ...candidate,
          restricted: isRestricted(entry),
        })),
      );
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      "The résumé JSON must include summary, experience, education, projects, skills, or certifications.",
    );
  }
  return candidates;
}

function normalizeHeading(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/:$/, "")
    .trim();
}

function sectionTypeFor(line: string): CareerLibraryItemType | null {
  const heading = normalizeHeading(line).toLowerCase().replace(/:$/, "");
  return SECTION_TYPES[heading] ?? null;
}

function parseMarkdownContact(
  lines: string[],
): ResumeImportCandidate | undefined {
  const values: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const nameHeading = /^#\s+(.+)$/.exec(trimmed);
    if (nameHeading) {
      values.push(`Name: ${nameHeading[1]!.trim()}`);
      continue;
    }
    if (/^(?:Headline|Email|Phone|Location|Website):\s*/i.test(trimmed)) {
      values.push(trimmed);
    }
  }
  if (values.length === 0) return undefined;
  return {
    id: createId(),
    type: "contact",
    section: "Contact",
    text: values.join("\n"),
    restricted: false,
  };
}

function groupLines(lines: string[]): string[] {
  const groups: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length > 0) groups.push(current.join("\n"));
      current = [];
      continue;
    }
    const text = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (text) {
      current.push(text);
    }
  }
  if (current.length > 0) groups.push(current.join("\n"));
  return groups;
}

function flattenValue(value: unknown): string[] {
  if (typeof value === "string") return value.split(/\r?\n/);
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => flattenValue(entry).join("\n"))
      .filter(Boolean)
      .join("\n\n")
      .split("\n\n");
  }
  if (isRecord(value)) {
    const text = Object.entries(value)
      .filter(
        ([key, entry]) =>
          key !== "restricted" &&
          key !== "sensitivity" &&
          entry !== null &&
          entry !== undefined,
      )
      .map(([key, entry]) => {
        const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
        const valueText = flattenValue(entry).join(", ");
        return `${label}: ${valueText}`;
      })
      .join("\n");
    return text ? [text] : [];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRestricted(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.restricted === true ||
      (typeof value.sensitivity === "string" &&
        value.sensitivity.toLowerCase() === "restricted"))
  );
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
