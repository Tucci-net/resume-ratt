import { describe, expect, it } from "vitest";
import {
  parseCareerLibraryJson,
  parseCareerLibraryMarkdown,
  serializeCareerLibraryJson,
  serializeCareerLibraryMarkdown,
} from "../lib/career-library/format";
import type { CareerLibraryItem } from "../lib/resume/model";

const items: CareerLibraryItem[] = [
  {
    id: "accomplishment-stable-id",
    type: "accomplishment",
    canonicalText: "Reduced deployment time by 35% using CI/CD automation.",
    tags: ["engineering", "impact"],
    skills: ["CI/CD", "automation"],
    metrics: ["35%"],
    source: "Platform engineering role",
    verificationStatus: "self-verified",
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-02-03T04:05:06.000Z",
  },
  {
    id: "project-stable-id",
    type: "project",
    canonicalText: "Built a volunteer scheduling application.",
    tags: [],
    skills: ["React"],
    metrics: [],
    verificationStatus: "unverified",
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-02T03:04:05.000Z",
  },
];

describe("Career Library interchange formats", () => {
  it("round-trips JSON with stable item metadata", () => {
    expect(
      parseCareerLibraryJson(serializeCareerLibraryJson(items)),
    ).toEqual(items);
  });

  it("round-trips Markdown documents with YAML front matter", () => {
    expect(
      parseCareerLibraryMarkdown(serializeCareerLibraryMarkdown(items)),
    ).toEqual(items);
  });

  it("accepts block-style YAML string arrays", () => {
    const markdown = `---
id: block-list
type: skill
tags:
  - engineering
  - platform work
skills: []
metrics: []
verificationStatus: verified
createdAt: "2026-01-02T03:04:05.000Z"
updatedAt: "2026-01-02T03:04:05.000Z"
---

TypeScript`;

    expect(parseCareerLibraryMarkdown(markdown)[0]?.tags).toEqual([
      "engineering",
      "platform work",
    ]);
  });

  it("accepts YAML flow-style arrays with quoted commas", () => {
    const markdown = `---
id: flow-list
type: skill
tags: [design, "research, testing"]
skills: [Figma]
metrics: []
verificationStatus: verified
createdAt: "2026-01-02T03:04:05.000Z"
updatedAt: "2026-01-02T03:04:05.000Z"
---

Product design`;

    expect(parseCareerLibraryMarkdown(markdown)[0]?.tags).toEqual([
      "design",
      "research, testing",
    ]);
  });

  it("rejects duplicate IDs and invalid JSON schemas", () => {
    expect(() => parseCareerLibraryJson('{"version":2,"items":[]}')).toThrow(
      "version 1",
    );
    expect(() =>
      serializeCareerLibraryMarkdown([items[0]!, items[0]!]),
    ).toThrow("Duplicate career library item ID");
  });
});
