import { describe, expect, it } from "vitest";
import {
  createInitialResumeDraftStore,
  parseResumeDraftStore,
  safeDesignForPersistence,
  serializeResumeDraftStore,
} from "../lib/resume/persistence";
import { DEFAULT_RESUME_DESIGN } from "../lib/resume/model";

describe("versioned local resume drafts", () => {
  it("round-trips multiple named drafts and active selection", () => {
    const store = createInitialResumeDraftStore();
    const second = {
      ...store.drafts[0]!,
      id: "second-draft",
      name: "Product design",
      resume: { ...store.drafts[0]!.resume, name: "Jordan Lee" },
    };
    const serialized = serializeResumeDraftStore({
      ...store,
      activeDraftId: second.id,
      drafts: [...store.drafts, second],
    });

    expect(parseResumeDraftStore(serialized).store).toMatchObject({
      version: 4,
      activeDraftId: "second-draft",
      drafts: [{ id: "default-resume" }, { id: "second-draft", name: "Product design" }],
    });
  });

  it("migrates version 1 drafts and adds missing library references", () => {
    const draft = createInitialResumeDraftStore().drafts[0]!;
    const { careerLibraryReferences, ...legacyResume } = draft.resume;
    void careerLibraryReferences;
    const legacy = JSON.stringify({
      version: 1,
      activeDraftId: draft.id,
      drafts: [{ ...draft, resume: legacyResume }],
    });

    const result = parseResumeDraftStore(legacy);
    expect(result.migrated).toBe(true);
    expect(result.store.version).toBe(4);
    expect(result.store.drafts[0]?.resume.careerLibraryReferences).toEqual([]);
    expect(result.store.snapshots).toEqual([]);
  });

  it("migrates version 2 presentation drafts without losing their content", () => {
    const store = createInitialResumeDraftStore();
    const draft = {
      ...store.drafts[0]!,
      resume: { ...store.drafts[0]!.resume, name: "Jordan Lee" },
    };
    const legacy = JSON.stringify({
      version: 2,
      activeDraftId: draft.id,
      drafts: [draft],
    });

    const result = parseResumeDraftStore(legacy);
    expect(result.migrated).toBe(true);
    expect(result.store.version).toBe(4);
    expect(result.store.drafts[0]?.resume.name).toBe("Jordan Lee");
    expect(result.store.snapshots).toEqual([]);
  });

  it("migrates version 3 drafts and assigns the first explicit revision", () => {
    const store = createInitialResumeDraftStore();
    const { revision: _revision, ...legacyDraft } = store.drafts[0]!;
    void _revision;
    const legacy = JSON.stringify({
      version: 3,
      activeDraftId: legacyDraft.id,
      drafts: [legacyDraft],
      snapshots: [],
    });

    const result = parseResumeDraftStore(legacy);
    expect(result.migrated).toBe(true);
    expect(result.store.version).toBe(4);
    expect(result.store.drafts[0]?.revision).toBe(1);
    expect(result.store.snapshots).toEqual([]);
  });

  it("falls back to a built-in font when a stored custom font is unavailable", () => {
    const store = createInitialResumeDraftStore();
    store.drafts[0]!.design.fontFamily = "custom-font-from-another-session";

    const result = parseResumeDraftStore(serializeResumeDraftStore(store));
    expect(result.store.drafts[0]?.design.fontFamily).toBe(
      DEFAULT_RESUME_DESIGN.fontFamily,
    );
    expect(result.warnings[0]).toContain("uploaded or unavailable font");
    expect(
      safeDesignForPersistence({
        ...DEFAULT_RESUME_DESIGN,
        fontFamily: "custom-font",
      }).fontFamily,
    ).toBe("inter");
  });

  it("rejects malformed, unsupported, or duplicate draft collections without fallback parsing", () => {
    expect(() => parseResumeDraftStore("{")).toThrow("not valid JSON");
    expect(() =>
      parseResumeDraftStore(JSON.stringify({ version: 99, drafts: [] })),
    ).toThrow("unsupported version");

    const store = createInitialResumeDraftStore();
    expect(() =>
      serializeResumeDraftStore({
        ...store,
        drafts: [store.drafts[0]!, { ...store.drafts[0]! }],
      }),
    ).toThrow("duplicate IDs");
  });
});
