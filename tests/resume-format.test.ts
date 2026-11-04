import { describe, expect, it } from "vitest";
import { splitResumeItems } from "../lib/resume/format";

describe("splitResumeItems", () => {
  it("splits comma- or line-separated content and removes empty items", () => {
    expect(splitResumeItems("TypeScript, React\n  Next.js ,, ")).toEqual([
      "TypeScript",
      "React",
      "Next.js",
    ]);
  });
});
