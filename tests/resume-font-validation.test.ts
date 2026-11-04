import { describe, expect, it } from "vitest";
import {
  isSupportedTtf,
  MAX_TTF_FILE_SIZE,
} from "../lib/resume/font-validation";

describe("isSupportedTtf", () => {
  it("accepts supported TrueType signatures with a .ttf extension", () => {
    expect(
      isSupportedTtf("resume-font.TTF", 100, new Uint8Array([0, 1, 0, 0])),
    ).toBe(true);
    expect(
      isSupportedTtf("legacy.ttf", 100, new Uint8Array([0x74, 0x72, 0x75, 0x65])),
    ).toBe(true);
  });

  it("rejects other extensions, signatures, empty files, and oversized files", () => {
    expect(isSupportedTtf("font.otf", 100, new Uint8Array([0, 1, 0, 0]))).toBe(
      false,
    );
    expect(isSupportedTtf("font.ttf", 100, new Uint8Array([0, 0, 0, 0]))).toBe(
      false,
    );
    expect(isSupportedTtf("font.ttf", 0, new Uint8Array([0, 1, 0, 0]))).toBe(
      false,
    );
    expect(
      isSupportedTtf(
        "font.ttf",
        MAX_TTF_FILE_SIZE + 1,
        new Uint8Array([0, 1, 0, 0]),
      ),
    ).toBe(false);
  });
});
