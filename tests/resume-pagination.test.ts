import { describe, expect, it } from "vitest";
import { paginateResumeBlocks } from "../lib/resume/pagination";

describe("Letter resume block pagination", () => {
  it("keeps measured blocks together and moves overflow to the next page", () => {
    expect(paginateResumeBlocks([300, 400, 250, 100], 800)).toEqual({
      pages: [[0, 1], [2, 3]],
      overflowingBlocks: [],
    });
  });

  it("isolates oversized blocks and reports them for overflow warnings", () => {
    expect(paginateResumeBlocks([300, 900, 200], 800)).toEqual({
      pages: [[0], [1], [2]],
      overflowingBlocks: [1],
    });
  });

  it("rejects invalid page capacities and block measurements", () => {
    expect(() => paginateResumeBlocks([], 0)).toThrow(
      "positive number",
    );
    expect(() => paginateResumeBlocks([Number.NaN], 800)).toThrow(
      "finite, non-negative",
    );
  });
});
