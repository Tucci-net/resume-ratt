import { describe, expect, it } from "vitest";
import { mergeCareerLibraryItems } from "../lib/career-library/merge";
import type { CareerLibraryItem } from "../lib/resume/model";

const item = (id: string, canonicalText: string): CareerLibraryItem => ({
  id,
  type: "skill",
  canonicalText,
  tags: [],
  skills: [],
  metrics: [],
  verificationStatus: "unverified",
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-02T03:04:05.000Z",
});

describe("Career Library import merging", () => {
  it("adds new IDs and never overwrites canonical items with matching IDs", () => {
    const existing = [item("stable-id", "Original canonical fact")];
    const result = mergeCareerLibraryItems(existing, [
      item("stable-id", "Conflicting imported text"),
      item("new-id", "New canonical fact"),
    ]);

    expect(result).toEqual({
      items: [
        existing[0],
        item("new-id", "New canonical fact"),
      ],
      added: 1,
      skipped: 1,
    });
    expect(result.items[0]?.canonicalText).toBe("Original canonical fact");
  });

  it("skips duplicate IDs within one imported document", () => {
    const result = mergeCareerLibraryItems([], [
      item("same-id", "First"),
      item("same-id", "Second"),
    ]);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.items[0]?.canonicalText).toBe("First");
  });
});
