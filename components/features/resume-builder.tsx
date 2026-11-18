"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Printer,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { AccordionSection } from "@/components/features/accordion-section";
import { AtsSafePreview } from "@/components/features/ats-safe-preview";
import { CareerLibraryPanel } from "@/components/features/career-library-panel";
import { ResumeContentEditor } from "@/components/features/resume-content-editor";
import { ResumeDocument } from "@/components/features/resume-document";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useResumeDrafts } from "@/hooks/use-resume-drafts";
import { useCareerLibrary } from "@/hooks/use-career-library";
import {
  DEFAULT_RESUME_DESIGN,
  INITIAL_RESUME,
  RESUME_FONTS,
} from "@/lib/resume/model";
import type {
  ResumeContent,
  ResumeFontOption,
  ResumeSectionConfig,
} from "@/lib/resume/model";
import {
  getStaleResumeReferences,
  updateDraftPresentationReferences,
} from "@/lib/resume/lifecycle";
import {
  isSupportedTtf,
  MAX_TTF_FILE_SIZE,
} from "@/lib/resume/font-validation";
import {
  hasResumeSectionContent,
  moveResumeSection,
  resetResumeSectionOrder,
  RESUME_SECTION_LABELS,
  setResumeSectionVisibility,
} from "@/lib/resume/sections";

type UploadedFont = ResumeFontOption & {
  fontFace: FontFace;
  objectUrl: string;
};

const SLIDER_CLASS =
  "mt-2 w-full accent-blue-600";
const INPUT_CLASS =
  "mt-1.5 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700";

export function ResumeBuilder() {
  const careerLibrary = useCareerLibrary();
  const {
    store,
    activeDraft,
    isLoaded,
    recoveryRequired,
    recoveryError,
    warnings,
    saveError,
    status,
    setResume: setDraftResume,
    submitActiveDraft,
    setDesign,
    setSections,
    selectDraft,
    createDraft,
    duplicateActiveDraft,
    renameActiveDraft,
    deleteActiveDraft,
    startFreshAfterRecovery,
  } = useResumeDrafts();
  const [draftNameInput, setDraftNameInput] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [uploadedFonts, setUploadedFonts] = useState<UploadedFont[]>([]);
  const uploadedFontsRef = useRef<UploadedFont[]>([]);
  const [fontError, setFontError] = useState("");
  const [isUploadingFont, setIsUploadingFont] = useState(false);
  const [targetApplicationId, setTargetApplicationId] = useState("");
  const [snapshotError, setSnapshotError] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const googleFontReady = useRef<Promise<void>>(Promise.resolve());
  const resume = activeDraft?.resume ?? INITIAL_RESUME;
  const staleReferences = getStaleResumeReferences(
    resume,
    careerLibrary.items,
  );
  const staleDraftIds = new Set(
    store.drafts
      .filter(
        (draft) =>
          getStaleResumeReferences(draft.resume, careerLibrary.items).length > 0,
      )
      .map((draft) => draft.id),
  );
  const design = activeDraft?.design ?? DEFAULT_RESUME_DESIGN;
  const sections = activeDraft?.sections ?? [];
  const selectedFont =
    RESUME_FONTS.find((font) => font.id === design.fontFamily) ??
    uploadedFonts.find((font) => font.id === design.fontFamily) ??
    RESUME_FONTS[0]!;

  function setResume(
    action: Parameters<typeof setDraftResume>[0],
  ) {
    setDraftResume((current) => {
      const updated =
        typeof action === "function" ? action(current) : action;
      return updateDraftPresentationReferences(current, updated);
    });
  }

  function submitResume() {
    try {
      const snapshot = submitActiveDraft(
        targetApplicationId,
        careerLibrary.items,
      );
      setSelectedSnapshotId(snapshot.id);
      setSnapshotError("");
    } catch (error) {
      setSnapshotError(
        error instanceof Error ? error.message : "The resume snapshot could not be saved.",
      );
    }
  }

  useEffect(() => {
    setDraftNameInput(activeDraft?.name ?? "");
  }, [activeDraft?.id, activeDraft?.name]);

  useEffect(() => {
    uploadedFontsRef.current = uploadedFonts;
  }, [uploadedFonts]);

  useEffect(
    () => () => {
      uploadedFontsRef.current.forEach((font) => {
        document.fonts.delete(font.fontFace);
        URL.revokeObjectURL(font.objectUrl);
      });
    },
    [],
  );

  useEffect(() => {
    if (!selectedFont.googleFontsUrl) {
      googleFontReady.current = Promise.resolve();
      return;
    }

    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://fonts.googleapis.com";
    const fontPreconnect = document.createElement("link");
    fontPreconnect.rel = "preconnect";
    fontPreconnect.href = "https://fonts.gstatic.com";
    fontPreconnect.crossOrigin = "anonymous";
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = selectedFont.googleFontsUrl;

    googleFontReady.current = new Promise((resolve) => {
      stylesheet.onload = () => resolve();
      stylesheet.onerror = () => {
        setFontError(
          `${selectedFont.name} could not be loaded. A system fallback will be used.`,
        );
        resolve();
      };
    });
    document.head.append(preconnect, fontPreconnect, stylesheet);

    return () => {
      preconnect.remove();
      fontPreconnect.remove();
      stylesheet.remove();
      googleFontReady.current = Promise.resolve();
    };
  }, [selectedFont]);

  async function uploadFont(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setFontError("");
    setIsUploadingFont(true);
    let objectUrl: string | undefined;

    try {
      const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (!isSupportedTtf(file.name, file.size, signature)) {
        throw new Error(
          `Choose a valid .ttf font file smaller than ${MAX_TTF_FILE_SIZE / 1024 / 1024} MB.`,
        );
      }
      if (typeof FontFace === "undefined" || !document.fonts) {
        throw new Error("Custom fonts are not supported by this browser.");
      }

      const id = `custom-${crypto.randomUUID()}`;
      const name = file.name.replace(/\.ttf$/i, "").trim() || "Custom font";
      const fontFaceFamily = `ResumeRatt-${id}`;
      const fontObjectUrl = URL.createObjectURL(file);
      objectUrl = fontObjectUrl;
      const fontFace = new FontFace(fontFaceFamily, `url("${fontObjectUrl}")`);
      await fontFace.load();
      document.fonts.add(fontFace);

      setUploadedFonts((current) => [
        ...current,
        {
          id,
          name,
          category: "Sans serif",
          fontFaceFamily,
          cssFamily: `"${fontFaceFamily}", sans-serif`,
          googleFontsUrl: "",
          fontFace,
          objectUrl: fontObjectUrl,
        },
      ]);
      setDesign((current) => ({ ...current, fontFamily: id }));
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setFontError(
        error instanceof Error &&
          (error.message.startsWith("Choose a valid .ttf") ||
            error.message === "Custom fonts are not supported by this browser.")
          ? error.message
          : "This font could not be loaded. Check that it is a valid, supported .ttf file.",
      );
    } finally {
      setIsUploadingFont(false);
    }
  }

  function removeUploadedFont(font: UploadedFont) {
    document.fonts.delete(font.fontFace);
    URL.revokeObjectURL(font.objectUrl);
    setUploadedFonts((current) =>
      current.filter((uploadedFont) => uploadedFont.id !== font.id),
    );
    if (design.fontFamily === font.id) {
      setDesign((current) => ({
        ...current,
        fontFamily: DEFAULT_RESUME_DESIGN.fontFamily,
      }));
    }
  }

  async function printResume() {
    await googleFontReady.current;
    await document.fonts.load(
      `${design.bodyFontSize}pt "${selectedFont.fontFaceFamily}"`,
    );
    await document.fonts.ready;
    window.print();
  }

  if (recoveryRequired) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
        <section
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <h1 className="text-xl font-semibold">Saved drafts need attention</h1>
          <p className="mt-2 text-sm">{recoveryError}</p>
          <p className="mt-2 text-sm">
            The saved data has not been overwritten. Starting fresh replaces it
            with a new blank draft.
          </p>
          <button
            type="button"
            onClick={startFreshAfterRecovery}
            className="mt-4 rounded-md bg-amber-950 px-4 py-2 text-sm font-medium text-white dark:bg-amber-100 dark:text-amber-950"
          >
            Start with a blank draft
          </button>
        </section>
      </main>
    );
  }

  if (!activeDraft) {
    return (
      <main className="resume-builder-main mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <p role="status">No active resume draft is available.</p>
      </main>
    );
  }

  return (
    <main
      className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8"
      inert={!isLoaded || !careerLibrary.isLoaded}
      aria-busy={!isLoaded || !careerLibrary.isLoaded}
    >
      <div className="resume-builder-header mb-6">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Working Draft
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Make your next move.
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Edit your details and see your resume take shape as you go.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1 text-sm font-medium">
            Resume draft
            <select
              aria-label="Resume draft"
              value={store.activeDraftId}
              onChange={(event) => selectDraft(event.target.value)}
              className={INPUT_CLASS}
            >
              {store.drafts.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {draft.name}
                  {staleDraftIds.has(draft.id) ? " · Career evidence changed" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 text-sm font-medium">
            Draft name
            <input
              aria-label="Draft name"
              value={draftNameInput}
              maxLength={100}
              onChange={(event) => setDraftNameInput(event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <button
            type="button"
            onClick={() => renameActiveDraft(draftNameInput)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={duplicateActiveDraft}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() =>
              createDraft(
                `Resume ${new Date().toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}`,
              )
            }
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            New draft
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={printResume}
            className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <label className="min-w-[14rem] flex-1 text-sm font-medium">
            Target job / application ID
            <input
              aria-label="Target job or application ID"
              value={targetApplicationId}
              onChange={(event) => setTargetApplicationId(event.target.value)}
              className={INPUT_CLASS}
              placeholder="Application identifier"
            />
          </label>
          <button
            type="button"
            onClick={submitResume}
            className="rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Mark as submitted
          </button>
          <span className="text-xs text-neutral-500">
            Saves an immutable submission snapshot; this working draft stays editable.
          </span>
          {snapshotError && (
            <p role="alert" className="w-full text-sm text-red-600">
              {snapshotError}
            </p>
          )}
        </div>
        {staleReferences.length > 0 && (
          <p
            role="status"
            className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          >
            Canonical Career Evidence changed for {staleReferences.length} linked
            item{staleReferences.length === 1 ? "" : "s"}. This Working Draft
            has not been rewritten.
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          <span role="status" aria-live="polite">
            {status === "loading"
              ? "Loading saved drafts…"
              : status === "saving"
                ? "Saving…"
                : status === "error"
                  ? "Not saved"
                  : "Saved in this browser"}
          </span>
          {isLoaded && activeDraft?.updatedAt && (
            <span>
              Last edited {new Date(activeDraft.updatedAt).toLocaleString()}
            </span>
          )}
          {saveError && <span role="alert">{saveError}</span>}
          {warnings.map((warning) => (
            <span key={warning} role="status">
              {warning}
            </span>
          ))}
        </div>
      </div>

      <div className="resume-builder-layout grid items-start gap-6 xl:grid-cols-2">
        <section
          className="resume-editor-panel"
          aria-label="Resume editor"
        >
          <div className="resume-editor-surface">
            <ResumeContentEditor resume={resume} setResume={setResume} />
            <div className="resume-editor-section px-5 py-5 sm:px-6">
              <SectionControls
                resume={resume}
                sections={sections}
                onChange={setSections}
              />
            </div>
            <div className="resume-editor-section px-5 py-5 sm:px-6">
              <AccordionSection
                title={
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold">Design</span>
                    <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                      Typography
                    </span>
                  </span>
                }
                description="Customize the look of your resume."
              >
                <div className="space-y-5 pt-5">
                <p
                  className="rounded-md bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800"
                  style={{ fontFamily: selectedFont.cssFamily }}
                  aria-live="polite"
                >
                  {selectedFont.name} · The quick brown fox
                </p>
                <label className="block text-sm font-medium">
                  Font family
                  <select
                    value={design.fontFamily}
                    onChange={(event) => {
                      setFontError("");
                      setDesign((current) => ({
                        ...current,
                        fontFamily: event.target.value,
                      }));
                    }}
                    className={INPUT_CLASS}
                  >
                    {(["Sans serif", "Serif"] as const).map((category) => (
                      <optgroup key={category} label={category}>
                        {RESUME_FONTS.filter(
                          (font) => font.category === category,
                        ).map((font) => (
                          <option
                            key={font.id}
                            value={font.id}
                            style={{ fontFamily: font.cssFamily }}
                          >
                            {font.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {uploadedFonts.length > 0 && (
                      <optgroup label="Uploaded fonts">
                        {uploadedFonts.map((font) => (
                          <option
                            key={font.id}
                            value={font.id}
                            style={{ fontFamily: font.cssFamily }}
                          >
                            Local · {font.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DesignSlider
                    label="Body font size"
                    value={design.bodyFontSize}
                    min={9}
                    max={12}
                    step={0.5}
                    displayValue={`${design.bodyFontSize} pt`}
                    onChange={(bodyFontSize) =>
                      setDesign((current) => ({ ...current, bodyFontSize }))
                    }
                  />
                  <DesignSlider
                    label="Heading scale"
                    value={design.headingScale}
                    min={1.6}
                    max={2.4}
                    step={0.1}
                    displayValue={`${design.headingScale.toFixed(1)}×`}
                    onChange={(headingScale) =>
                      setDesign((current) => ({ ...current, headingScale }))
                    }
                  />
                  <DesignSlider
                    label="Line spacing"
                    value={design.lineHeight}
                    min={1.25}
                    max={1.65}
                    step={0.05}
                    displayValue={design.lineHeight.toFixed(2)}
                    onChange={(lineHeight) =>
                      setDesign((current) => ({ ...current, lineHeight }))
                    }
                  />
                  <DesignSlider
                    label="Section spacing"
                    value={design.sectionSpacing}
                    min={10}
                    max={30}
                    step={2}
                    displayValue={`${design.sectionSpacing} px`}
                    onChange={(sectionSpacing) =>
                      setDesign((current) => ({ ...current, sectionSpacing }))
                    }
                  />
                </div>
                <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  <p className="text-sm font-medium">Custom font</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Upload a TrueType .ttf file up to 10 MB. It stays in this
                    browser session.
                  </p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                    <Upload className="h-4 w-4" />
                    {isUploadingFont ? "Loading font…" : "Upload .ttf"}
                    <input
                      type="file"
                      accept=".ttf,font/ttf"
                      onChange={uploadFont}
                      disabled={isUploadingFont}
                      className="sr-only"
                    />
                  </label>
                  {fontError && (
                    <p
                      role="alert"
                      className="mt-3 flex items-start gap-2 text-sm text-red-600 dark:text-red-400"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {fontError}
                    </p>
                  )}
                  {uploadedFonts.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {uploadedFonts.map((font) => (
                        <li
                          key={font.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                        >
                          <span
                            className="flex min-w-0 items-center gap-2 truncate text-sm"
                            style={{ fontFamily: font.cssFamily }}
                          >
                            {design.fontFamily === font.id && (
                              <Check
                                aria-label="Selected"
                                className="h-4 w-4 shrink-0 text-emerald-600"
                              />
                            )}
                            <span className="truncate">
                              Local · {font.name}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeUploadedFont(font)}
                            aria-label={`Remove ${font.name}`}
                            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                </div>
              </AccordionSection>
            </div>
          </div>
          <CareerLibraryPanel
            resume={resume}
            setResume={setResume}
            draftId={activeDraft.id}
            careerLibrary={careerLibrary}
          />
        </section>

        <div>
          <ResumeDocument
            resume={resume}
            sections={sections}
            design={design}
            fontFamily={selectedFont.cssFamily}
          />
          <div className="resume-ats-preview">
            <AtsSafePreview resume={resume} sections={sections} />
          </div>
        </div>
        {store.snapshots.length > 0 && (
          <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold">Submitted Snapshots</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Immutable records of submitted content and the canonical evidence revisions used.
            </p>
            <label className="mt-4 block max-w-xl text-sm font-medium">
              Submitted Snapshot
              <select
                aria-label="Submitted Snapshot"
                value={selectedSnapshotId}
                onChange={(event) => setSelectedSnapshotId(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Choose a submitted snapshot</option>
                {store.snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.targetApplicationId} · {snapshot.draftName} ·{" "}
                    {new Date(snapshot.submittedAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            {store.snapshots
              .filter((snapshot) => snapshot.id === selectedSnapshotId)
              .map((snapshot) => (
                <div key={snapshot.id} className="mt-4 space-y-4">
                  <div>
                    <h3 className="mb-2 font-medium">Submitted Snapshot preview</h3>
                    <ResumeDocument
                      resume={{
                        ...snapshot.content,
                        experience: snapshot.content.experience.map((entry) => ({
                          ...entry,
                          accomplishments: [...entry.accomplishments],
                        })),
                        education: snapshot.content.education.map((entry) => ({
                          ...entry,
                        })),
                        projects: snapshot.content.projects.map((entry) => ({
                          ...entry,
                          accomplishments: [...entry.accomplishments],
                        })),
                        certifications: snapshot.content.certifications.map(
                          (entry) => ({ ...entry }),
                        ),
                        careerLibraryReferences:
                          snapshot.content.careerLibraryReferences.map(
                            (reference) => ({
                              ...reference,
                              evidenceIds: reference.evidenceIds
                                ? [...reference.evidenceIds]
                                : undefined,
                            }),
                          ),
                      }}
                      sections={snapshot.sections.map((section) => ({ ...section }))}
                      design={{ ...snapshot.design }}
                      fontFamily={
                        RESUME_FONTS.find(
                          (font) => font.id === snapshot.design.fontFamily,
                        )?.cssFamily ?? RESUME_FONTS[0]!.cssFamily
                      }
                    />
                  </div>
                  <div className="rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-800">
                    <p>
                      <strong>Submitted Snapshot:</strong> {snapshot.content.name || snapshot.draftName}
                    </p>
                    <p>
                      <strong>Application:</strong> {snapshot.targetApplicationId}
                    </p>
                    <p>
                      <strong>Submitted:</strong>{" "}
                      {new Date(snapshot.submittedAt).toLocaleString()}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">{snapshot.content.summary}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Canonical evidence at submission vs current</h3>
                    {snapshot.sources.length === 0 ? (
                      <p className="mt-2 text-sm text-neutral-500">
                        This snapshot has no linked Career Library evidence.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-3">
                        {snapshot.sources.map((source) => {
                          const current = careerLibrary.items.find(
                            (item) => item.id === source.libraryItemId,
                          );
                          const currentRevision =
                            current?.canonicalRevisionId ?? current?.updatedAt ?? null;
                          const changed =
                            !current ||
                            currentRevision !== source.canonicalRevisionId;
                          return (
                            <li
                              key={source.libraryItemId}
                              className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-700"
                            >
                              <p className="font-medium">
                                {source.libraryItemId}
                                {changed && (
                                  <span className="ml-2 text-amber-700 dark:text-amber-300">
                                    Canonical evidence changed
                                  </span>
                                )}
                              </p>
                              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                <p className="whitespace-pre-wrap">
                                  <strong>At submission:</strong>
                                  {"\n"}{source.canonicalTextAtSubmission}
                                </p>
                                <p className="whitespace-pre-wrap">
                                  <strong>Current:</strong>
                                  {"\n"}{current?.canonicalText ?? "Career Library record no longer exists."}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
          </section>
        )}
      </div>
      <p className="resume-builder-footer mt-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
        Your draft stays in this browser session. Use Print / Save as PDF to
        keep a copy.
      </p>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="Delete resume?"
        description={`“${activeDraft.name}” and its content will be permanently deleted from this browser. This action cannot be undone.`}
        confirmLabel="Delete resume"
        cancelLabel="Keep resume"
        destructive
        onConfirm={deleteActiveDraft}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </main>
  );
}

function SectionControls({
  resume,
  sections,
  onChange,
}: {
  resume: ResumeContent;
  sections: ResumeSectionConfig[];
  onChange: (sections: ResumeSectionConfig[]) => void;
}) {
  return (
    <AccordionSection
      title={
        <span className="flex items-center justify-between gap-3">
          <span className="text-lg font-semibold">Page structure</span>
          <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
            Order & visibility
          </span>
        </span>
      }
      description="Choose which sections appear and arrange their order."
    >
      <div className="space-y-2 pt-5">
        {sections.map((section, index) => {
          const hasContent = hasResumeSectionContent(resume, section.id);
          return (
            <div
              key={section.id}
              className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
            >
              <span
                aria-hidden="true"
                className="w-5 shrink-0 text-xs text-neutral-400"
              >
                {index + 1}.
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {RESUME_SECTION_LABELS[section.id]}
                </span>
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {hasContent ? "Has content" : "Empty"}
                  {!section.visible ? " · Hidden" : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange(
                    moveResumeSection(
                      sections,
                      section.id,
                      -1,
                    ),
                  )
                }
                disabled={index === 0}
                aria-label={`Move ${RESUME_SECTION_LABELS[section.id]} up`}
                className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange(moveResumeSection(sections, section.id, 1))
                }
                disabled={index === sections.length - 1}
                aria-label={`Move ${RESUME_SECTION_LABELS[section.id]} down`}
                className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange(
                    setResumeSectionVisibility(
                      sections,
                      section.id,
                      !section.visible,
                    ),
                  )
                }
                aria-label={`${section.visible ? "Hide" : "Show"} ${RESUME_SECTION_LABELS[section.id]}`}
                className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {section.visible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onChange(resetResumeSectionOrder(sections))}
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <RotateCcw className="h-4 w-4" />
          Restore default order
        </button>
      </div>
    </AccordionSection>
  );
}

function DesignSlider({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="flex items-center justify-between gap-2 font-medium">
        {label}
        <output className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
          {displayValue}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className={SLIDER_CLASS}
      />
    </label>
  );
}
