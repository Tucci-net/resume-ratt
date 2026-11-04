import { describe, expect, it } from "vitest";
import { splitResumeItems } from "../lib/resume/format";

describe("empty resume content", () => {
  it("does not render blank skills or accomplishment items", () => {
    expect(splitResumeItems(" \n , ")).toEqual([]);
  });
});