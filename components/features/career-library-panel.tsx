"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from "react";
import { Download, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { AccordionSection } from "@/components/features/accordion-section";
import type { useCareerLibrary } from "@/hooks/use-career-library";
import {
  parseCareerLibraryJson,
  parseCareerLibraryMarkdown,
  serializeCareerLibraryJson,
  serializeCareerLibraryMarkdown,
} from "@/lib/career-library/format";
import { reconcileCareerLibraryItems } from "@/lib/career-library/merge";
import { proposeCareerLibraryVariant } from "@/lib/resume/lifecycle";
import { splitResumeItems } from "@/lib/resume/format";
import {
  parseResumeJson,
  parseResumeText,
} from "@/lib/resume/import";
import type { ResumeImportCandidate } from "@/lib/resume/import";
import type {
  CareerLibraryItem,
  CareerLibraryItemType,
  CareerLibraryVerificationStatus,
  ResumeContent,
  ResumeLibraryReference,
  ResumeSectionId,
} from "@/lib/resume/model";
import { RESUME_SECTION_LABELS } from "@/lib/resume/sections";

const TYPES: CareerLibraryItemType[] = [
  "accomplishment",
  "experience",
  "project",
  "skill",
  "summary",
  "education",
  "certification",
];
const STATUSES: CareerLibraryVerificationStatus[] = [
  "unverified",
  "self-verified",
  "verified",
];
const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700";

export function CareerLibraryPanel({
  resume,
  setResume,
  draftId,
  careerLibrary,
}: {
  resume: ResumeContent;
  setResume: Dispatch<SetStateAction<ResumeContent>>;
  draftId: string;
  careerLibrary: ReturnType<typeof useCareerLibrary>;
}) {
  const {
    items,
    isLoaded,
    recoveryRequired,
    error,
    setError,
    updateItems,
    startFreshAfterRecovery,
  } = careerLibrary;
  const [newType, setNewType] =
    useState<CareerLibraryItemType>("accomplishment");
  const [newText, setNewText] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newSkills, setNewSkills] = useState("");
  const [newMetrics, setNewMetrics] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newRestricted, setNewRestricted] = useState(false);
  const [notice, setNotice] = useState("");
  const [isResumeImportOpen, setIsResumeImportOpen] = useState(false);
  const [resumeImportText, setResumeImportText] = useState("");
  const [resumeImportCandidates, setResumeImportCandidates] = useState<
    ResumeImportCandidate[]
  >([]);
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [resumeImportError, setResumeImportError] = useState("");

  function addItem() {
    const canonicalText = newText.trim();
    if (!canonicalText) {
      setError("Enter canonical text before adding a library item.");
      return;
    }
    const now = new Date().toISOString();
    const item: CareerLibraryItem = {
      id: crypto.randomUUID(),
      type: newType,
      canonicalText,
      canonicalRevisionId: crypto.randomUUID(),
      tags: parseList(newTags),
      skills: parseList(newSkills),
      metrics: parseList(newMetrics),
      ...(newRestricted ? { restricted: true } : {}),
      ...(newSource.trim() ? { source: newSource.trim() } : {}),
      verificationStatus: "unverified",
      createdAt: now,
      updatedAt: now,
    };
    updateItems((current) => [...current, item]);
    setNewText("");
    setNewTags("");
    setNewSkills("");
    setNewMetrics("");
    setNewSource("");
    setNewRestricted(false);
    setError("");
    setNotice("Added to the Career Library.");
  }

  function updateItem(id: string, patch: Partial<CareerLibraryItem>) {
    const previous = items.find((item) => item.id === id);
    if (previous) {
      const updated = {
        ...previous,
        ...patch,
        id: previous.id,
        updatedAt: new Date().toISOString(),
        canonicalRevisionId:
          "canonicalText" in patch || "type" in patch
            ? crypto.randomUUID()
            : (previous.canonicalRevisionId ?? previous.updatedAt),
      };
      updateItems((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      return;
    }
    updateItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, ...patch, id: item.id, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
  }

  function insertItem(
    item: CareerLibraryItem,
    resumeText: string,
    relationship: "copy" | "reference",
  ) {
    if (
      resume.careerLibraryReferences.some(
        (reference) => reference.libraryItemId === item.id,
      )
    ) {
      setError("This Career Library item is already used in this resume.");
      return;
    }
    const wording = resumeText.trim();
    if (!wording) {
      setError("Resume-specific wording cannot be empty.");
      return;
    }
    const section = getTargetSection(item.type);
    const reference: ResumeLibraryReference = {
      libraryItemId: item.id,
      type: item.type,
      section,
      relationship,
      resumeText: wording,
      libraryItemUpdatedAt: item.updatedAt,
      canonicalRevisionId: item.canonicalRevisionId ?? item.updatedAt,
      canonicalTextAtLink: item.canonicalText,
      evidenceIds: [],
    };

    setResume((current) => {
      let updated: ResumeContent = { ...current };
      switch (item.type) {
        case "experience":
          updated = {
            ...updated,
            experience: [
              ...current.experience,
              {
                id: item.id,
                employer: "",
                jobTitle: wording,
                location: "",
                startDate: "",
                endDate: "",
                currentRole: false,
                accomplishments: [],
              },
            ],
          };
          break;
        case "accomplishment": {
          const experience = [...current.experience];
          const lastIndex = experience.length - 1;
          if (lastIndex >= 0) {
            const last = experience[lastIndex]!;
            experience[lastIndex] = {
              ...last,
              accomplishments: [...last.accomplishments, wording],
            };
          } else {
            experience.push({
              id: crypto.randomUUID(),
              employer: "",
              jobTitle: "",
              location: "",
              startDate: "",
              endDate: "",
              currentRole: false,
              accomplishments: [wording],
            });
          }
          updated = { ...updated, experience };
          break;
        }
        case "project":
          updated = {
            ...updated,
            projects: [
              ...current.projects,
              {
                id: item.id,
                name: wording,
                subtitle: "",
                startDate: "",
                endDate: "",
                url: "",
                description: "",
                accomplishments: [],
              },
            ],
          };
          break;
        case "skill": {
          const skills = splitResumeItems(current.skills);
          if (!skills.some((skill) => skill.toLowerCase() === wording.toLowerCase())) {
            skills.push(wording);
          }
          updated = { ...updated, skills: skills.join(", ") };
          break;
        }
        case "summary":
          updated = {
            ...updated,
            summary: [current.summary.trim(), wording].filter(Boolean).join("\n\n"),
          };
          break;
        case "education":
          updated = {
            ...updated,
            education: [
              ...current.education,
              {
                id: item.id,
                institution: wording,
                degree: "",
                fieldOfStudy: "",
                location: "",
                startDate: "",
                endDate: "",
                currentlyEnrolled: false,
                gpa: "",
                honors: "",
              },
            ],
          };
          break;
        case "certification":
          updated = {
            ...updated,
            certifications: [
              ...current.certifications,
              {
                id: item.id,
                name: wording,
                issuer: "",
                issueDate: "",
                expirationDate: "",
                credentialId: "",
                credentialUrl: "",
              },
            ],
          };
          break;
      }

      return {
        ...updated,
        careerLibraryReferences: [
          ...current.careerLibraryReferences,
          reference,
        ],
      };
    });
    setError("");
    setNotice(
      `Added resume wording to ${RESUME_SECTION_LABELS[section]}. Canonical library text is unchanged.`,
    );
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const contents = await file.text();
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith(".json") && !lowerName.endsWith(".md") && !lowerName.endsWith(".markdown")) {
        throw new Error("Choose a JSON or Markdown Career Library file.");
      }
      const imported = lowerName.endsWith(".json")
        ? parseCareerLibraryJson(contents)
        : parseCareerLibraryMarkdown(contents);
      const reconciliation = reconcileCareerLibraryItems(items, imported);
      updateItems(() => reconciliation.items);
      setError("");
      setNotice(
        `Imported ${reconciliation.added}, updated ${reconciliation.updated}, skipped ${reconciliation.skipped}, and protected ${reconciliation.conflicts} conflicting item${reconciliation.conflicts === 1 ? "" : "s"}.`,
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The Career Library file could not be imported.",
      );
    }
  }

  function parseResumeImport(contents = resumeImportText, filename = "") {
    try {
      const lowerName = filename.toLowerCase();
      const candidates =
        lowerName.endsWith(".json") || contents.trimStart().startsWith("{")
          ? parseResumeJson(contents)
          : parseResumeText(contents);
      if (candidates.length === 0) {
        throw new Error(
          "No résumé sections were recognized. Use headings such as Summary, Experience, Education, Projects, Skills, or Certifications.",
        );
      }
      setResumeImportCandidates(candidates);
      setSelectedImportIds(
        candidates
          .filter((candidate) => !candidate.restricted)
          .map((candidate) => candidate.id),
      );
      setResumeImportError("");
    } catch (parseError) {
      setResumeImportCandidates([]);
      setSelectedImportIds([]);
      setResumeImportError(
        parseError instanceof Error
          ? parseError.message
          : "The résumé could not be parsed.",
      );
    }
  }

  async function loadResumeImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const contents = await file.text();
      setResumeImportText(contents);
      parseResumeImport(contents, file.name);
    } catch (readError) {
      setResumeImportError(
        readError instanceof Error
          ? readError.message
          : "The résumé file could not be read.",
      );
    }
  }

  function approveResumeImport() {
    const chosen = resumeImportCandidates.filter((candidate) =>
      selectedImportIds.includes(candidate.id),
    );
    if (chosen.length === 0) {
      setResumeImportError("Select at least one item to import.");
      return;
    }
    const now = new Date().toISOString();
    const importedItems: CareerLibraryItem[] = chosen.map((candidate) => ({
      id: candidate.id,
      type: candidate.type,
      canonicalText: candidate.text.trim(),
      tags: [candidate.section],
      skills: [],
      metrics: [],
      ...(candidate.restricted ? { restricted: true } : {}),
      source: "Résumé import",
      verificationStatus: "unverified",
      createdAt: now,
      updatedAt: now,
      canonicalRevisionId: crypto.randomUUID(),
    }));
    updateItems((current) => [...current, ...importedItems]);
    setResume((current) => appendImportedItems(current, importedItems));
    setNotice(
      `Added ${importedItems.length} reviewed item${importedItems.length === 1 ? "" : "s"} to the Career Library.`,
    );
    setResumeImportCandidates([]);
    setSelectedImportIds([]);
    setResumeImportText("");
    setResumeImportError("");
    setIsResumeImportOpen(false);
  }

  function exportFile(format: "json" | "md") {
    try {
      const content =
        format === "json"
          ? serializeCareerLibraryJson(items)
          : serializeCareerLibraryMarkdown(items);
      downloadText(
        `resume-ratt-career-library.${format}`,
        content,
        format === "json" ? "application/json" : "text/markdown",
      );
      setError("");
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "The Career Library could not be exported.",
      );
    }
  }

  if (!isLoaded) return null;

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <AccordionSection
        title={
          <span className="text-lg font-semibold">
            Career Library · Canonical Career Evidence
          </span>
        }
        description="Canonical factual claims and evidence. Draft wording is kept separate unless you propose a wording variant."
      >
        <div className="space-y-5 pt-5">
          {recoveryRequired ? (
            <div
              role="alert"
              className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <p>{error}</p>
              <p className="mt-2">
                Existing library data was preserved. Starting fresh replaces
                the malformed data.
              </p>
              <button
                type="button"
                onClick={startFreshAfterRecovery}
                className="mt-3 rounded-md border border-current px-3 py-1.5"
              >
                Start an empty library
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsResumeImportOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                >
                  <FileText className="h-4 w-4" />
                  Import Resume
                </button>
                <button
                  type="button"
                  onClick={() => exportFile("json")}
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
                >
                  <Download className="h-4 w-4" />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => exportFile("md")}
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
                >
                  <Download className="h-4 w-4" />
                  Export Markdown
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
                  <Upload className="h-4 w-4" />
                  Import JSON / Markdown
                  <input
                    type="file"
                    accept=".json,.md,.markdown,application/json,text/markdown"
                    onChange={importFile}
                    className="sr-only"
                  />
                </label>
              </div>

              {isResumeImportOpen && (
                <section
                  aria-label="Import Resume"
                  className="rounded-lg border border-blue-300 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">Import Resume</h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        Paste text or load a Markdown, text, or JSON résumé.
                        Nothing is saved until you review and approve it.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close resume import"
                      onClick={() => {
                        setIsResumeImportOpen(false);
                        setResumeImportText("");
                        setResumeImportCandidates([]);
                        setSelectedImportIds([]);
                        setResumeImportError("");
                      }}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    aria-label="Résumé text to import"
                    value={resumeImportText}
                    onChange={(event) => {
                      setResumeImportText(event.target.value);
                      setResumeImportCandidates([]);
                    }}
                    rows={8}
                    placeholder={"Summary\n...\n\nExperience\n..."}
                    className={INPUT_CLASS}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => parseResumeImport()}
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
                    >
                      Review pasted text
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
                      <Upload className="h-4 w-4" />
                      Choose Markdown / JSON
                      <input
                        type="file"
                        accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
                        onChange={loadResumeImportFile}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  {resumeImportError && (
                    <p role="alert" className="mt-3 text-sm text-red-600">
                      {resumeImportError}
                    </p>
                  )}
                  {resumeImportCandidates.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <h4 className="text-sm font-semibold">Review Import</h4>
                      {resumeImportCandidates.map((candidate) => (
                        <article
                          key={candidate.id}
                          className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                        >
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={selectedImportIds.includes(candidate.id)}
                              onChange={(event) =>
                                setSelectedImportIds((current) =>
                                  event.target.checked
                                    ? [...current, candidate.id]
                                    : current.filter((id) => id !== candidate.id),
                                )
                              }
                            />
                            {candidate.section} · {candidate.type}
                            {candidate.restricted && (
                              <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
                                Restricted evidence · excluded by default
                              </span>
                            )}
                          </label>
                          <textarea
                            aria-label={`Edit ${candidate.section} import item`}
                            value={candidate.text}
                            onChange={(event) =>
                              setResumeImportCandidates((current) =>
                                current.map((item) =>
                                  item.id === candidate.id
                                    ? { ...item, text: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            rows={3}
                            className={INPUT_CLASS}
                          />
                        </article>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={approveResumeImport}
                          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                        >
                          Approve and save selected items
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResumeImportCandidates([]);
                            setSelectedImportIds([]);
                            setResumeImportError("");
                          }}
                          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
                        >
                          Reject parsed items
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <h3 className="font-medium">Add canonical item</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Type">
                    <select
                      value={newType}
                      onChange={(event) =>
                        setNewType(event.target.value as CareerLibraryItemType)
                      }
                      className={INPUT_CLASS}
                    >
                      {TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newRestricted}
                      onChange={(event) =>
                        setNewRestricted(event.target.checked)
                      }
                    />
                    Mark as restricted evidence
                  </label>
                  <Field label="Canonical text">
                    <textarea
                      value={newText}
                      onChange={(event) => setNewText(event.target.value)}
                      rows={2}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Tags (comma-separated)">
                    <input
                      value={newTags}
                      onChange={(event) => setNewTags(event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Skills (comma-separated)">
                    <input
                      value={newSkills}
                      onChange={(event) => setNewSkills(event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Metrics (comma-separated)">
                    <input
                      value={newMetrics}
                      onChange={(event) => setNewMetrics(event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Source (optional)">
                    <input
                      value={newSource}
                      onChange={(event) => setNewSource(event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                >
                  <Plus className="h-4 w-4" />
                  Add to library
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No library items yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item.id}>
                      <CareerLibraryItemCard
                        item={item}
                        onUpdate={(patch) => updateItem(item.id, patch)}
                        onDelete={() =>
                          updateItems((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
                        onInsert={insertItem}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {resume.careerLibraryReferences.length > 0 && (
                <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold">Canonical Career Evidence in this Working Draft</h3>
                  <ul className="mt-2 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                    {resume.careerLibraryReferences.map((reference, index) => {
                      const item = items.find(
                        (entry) => entry.id === reference.libraryItemId,
                      );
                      const differs = Boolean(
                        item && reference.resumeText.trim() !== item.canonicalText.trim(),
                      );
                      return (
                        <li
                          key={`${reference.libraryItemId}-${index}`}
                          className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
                        >
                          <p>
                            {reference.relationship} · {reference.type} ·{" "}
                            {reference.resumeText}
                          </p>
                          {differs && item && (
                            <div className="mt-2">
                              <p className="text-xs">
                                Draft wording differs from canonical evidence. It remains
                                draft-only unless you explicitly propose it as a variant.
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResume((current) => ({
                                      ...current,
                                      careerLibraryReferences:
                                        current.careerLibraryReferences.map((entry) =>
                                          entry.libraryItemId === item.id
                                            ? {
                                                ...entry,
                                                relationship: "copy",
                                                variantId: undefined,
                                              }
                                            : entry,
                                        ),
                                    }));
                                    setNotice("Wording saved to this Working Draft only. Canonical Career Evidence is unchanged.");
                                  }}
                                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700"
                                >
                                  Save to this draft only
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    try {
                                      const { item: updated, variant } =
                                        proposeCareerLibraryVariant(
                                          item,
                                          reference.resumeText,
                                          draftId,
                                        );
                                      updateItems((current) =>
                                        current.map((entry) =>
                                          entry.id === item.id ? updated : entry,
                                        ),
                                      );
                                      setResume((current) => ({
                                        ...current,
                                        careerLibraryReferences:
                                          current.careerLibraryReferences.map((entry) =>
                                            entry.libraryItemId === item.id
                                              ? { ...entry, variantId: variant.id }
                                              : entry,
                                          ),
                                      }));
                                      setNotice("Proposed wording variant saved; canonical evidence is unchanged.");
                                      setError("");
                                    } catch (proposalError) {
                                      setError(
                                        proposalError instanceof Error
                                          ? proposalError.message
                                          : "The wording variant could not be proposed.",
                                      );
                                    }
                                  }}
                                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700"
                                >
                                  Propose as a new Career Library wording variant
                                </button>
                              </div>
                            </div>
                          )}
                          {item?.variants?.filter((variant) => variant.status === "proposed")
                            .map((variant) => (
                              <p key={variant.id} className="mt-2 text-xs">
                                Proposed variant: {variant.text}
                              </p>
                            ))}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
          {error && !recoveryRequired && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
              {notice}
            </p>
          )}
        </div>
      </AccordionSection>
    </section>
  );
}

function appendImportedItems(
  resume: ResumeContent,
  items: CareerLibraryItem[],
): ResumeContent {
  const updated: ResumeContent = { ...resume };
  for (const item of items) {
    const lines = item.canonicalText.split("\n").map((line) => line.trim());
    const firstLine = lines[0] ?? item.canonicalText;
    switch (item.type) {
      case "summary":
        updated.summary = [updated.summary.trim(), item.canonicalText]
          .filter(Boolean)
          .join("\n\n");
        break;
      case "experience": {
        const [jobTitle, employer] = firstLine.split(/\s+[—–-]\s+/, 2);
        updated.experience = [
          ...updated.experience,
          {
            id: item.id,
            jobTitle: jobTitle ?? firstLine,
            employer: employer ?? "",
            location: "",
            startDate: "",
            endDate: "",
            currentRole: false,
            accomplishments: lines.slice(1).filter(Boolean),
          },
        ];
        break;
      }
      case "accomplishment":
        updated.experience = [
          ...updated.experience,
          {
            id: item.id,
            employer: "",
            jobTitle: "",
            location: "",
            startDate: "",
            endDate: "",
            currentRole: false,
            accomplishments: [item.canonicalText],
          },
        ];
        break;
      case "project":
        updated.projects = [
          ...updated.projects,
          {
            id: item.id,
            name: firstLine,
            subtitle: "",
            startDate: "",
            endDate: "",
            url: "",
            description: lines.slice(1).filter(Boolean).join("\n"),
            accomplishments: [],
          },
        ];
        break;
      case "education":
        updated.education = [
          ...updated.education,
          {
            id: item.id,
            institution: firstLine,
            degree: "",
            fieldOfStudy: "",
            location: "",
            startDate: "",
            endDate: "",
            currentlyEnrolled: false,
            gpa: "",
            honors: lines.slice(1).filter(Boolean).join("\n"),
          },
        ];
        break;
      case "skill": {
        const skills = splitResumeItems(updated.skills);
        for (const skill of splitResumeItems(item.canonicalText)) {
          if (!skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
            skills.push(skill);
          }
        }
        updated.skills = skills.join(", ");
        break;
      }
      case "certification":
        updated.certifications = [
          ...updated.certifications,
          {
            id: item.id,
            name: firstLine,
            issuer: "",
            issueDate: "",
            expirationDate: "",
            credentialId: "",
            credentialUrl: "",
          },
        ];
        break;
    }
  }
  updated.careerLibraryReferences = [
    ...resume.careerLibraryReferences,
    ...items.map((item) => ({
      libraryItemId: item.id,
      type: item.type,
      section: getTargetSection(item.type),
      relationship: "reference" as const,
      resumeText: item.canonicalText,
      libraryItemUpdatedAt: item.updatedAt,
      canonicalRevisionId: item.canonicalRevisionId ?? item.updatedAt,
      canonicalTextAtLink: item.canonicalText,
      evidenceIds: [],
    })),
  ];
  return updated;
}

function CareerLibraryItemCard({
  item,
  onUpdate,
  onDelete,
  onInsert,
}: {
  item: CareerLibraryItem;
  onUpdate: (patch: Partial<CareerLibraryItem>) => void;
  onDelete: () => void;
  onInsert: (
    item: CareerLibraryItem,
    resumeText: string,
    relationship: "copy" | "reference",
  ) => void;
}) {
  const [resumeText, setResumeText] = useState(item.canonicalText);
  const [relationship, setRelationship] =
    useState<"copy" | "reference">("copy");

  useEffect(() => setResumeText(item.canonicalText), [item.canonicalText]);

  return (
    <article className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {item.type} · {item.verificationStatus} · ID {item.id}
          </p>
          <label className="mt-2 block text-sm font-medium">
            Canonical text
            <textarea
              value={item.canonicalText}
              onChange={(event) =>
                onUpdate({ canonicalText: event.target.value })
              }
              rows={2}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.type} library item`}
          className="rounded-md p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <select
            value={item.type}
            onChange={(event) =>
              onUpdate({ type: event.target.value as CareerLibraryItemType })
            }
            className={INPUT_CLASS}
          >
            {TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field label="Verification">
          <select
            value={item.verificationStatus}
            onChange={(event) =>
              onUpdate({
                verificationStatus: event.target
                  .value as CareerLibraryVerificationStatus,
              })
            }
            className={INPUT_CLASS}
          >
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <EditableList
          label="Tags"
          values={item.tags}
          onChange={(tags) => onUpdate({ tags })}
        />
        <EditableList
          label="Skills"
          values={item.skills}
          onChange={(skills) => onUpdate({ skills })}
        />
        <EditableList
          label="Metrics"
          values={item.metrics}
          onChange={(metrics) => onUpdate({ metrics })}
        />
        <Field label="Source">
          <input
            value={item.source ?? ""}
            onChange={(event) =>
              onUpdate({
                source: event.target.value || undefined,
              })
            }
            className={INPUT_CLASS}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            aria-label={`Restricted evidence for ${item.id}`}
            checked={Boolean(item.restricted)}
            onChange={(event) =>
              onUpdate({ restricted: event.target.checked || undefined })
            }
          />
          Restricted evidence
        </label>
      </div>
      {item.restricted && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Restricted evidence · excluded by default during résumé import review.
        </p>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        Updated {new Date(item.updatedAt).toLocaleString()}
      </p>
      {item.variants && item.variants.length > 0 && (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <h4 className="text-sm font-medium">Wording variants</h4>
          <ul className="mt-2 space-y-2">
            {item.variants.map((variant) => (
              <li
                key={variant.id}
                className="rounded-md bg-neutral-50 p-2 text-sm dark:bg-neutral-800"
              >
                <p>{variant.text}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {variant.status}
                  {variant.sourceDraftId ? ` · proposed from ${variant.sourceDraftId}` : ""}
                </p>
                {variant.status === "proposed" && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({
                        variants: item.variants?.map((entry) =>
                          entry.id === variant.id
                            ? { ...entry, status: "approved" }
                            : entry,
                        ),
                      })
                    }
                    className="mt-2 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                  >
                    Approve variant
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <label className="block text-sm font-medium">
          Resume-specific wording
          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </label>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Relationship
            <select
              value={relationship}
              onChange={(event) =>
                setRelationship(event.target.value as "copy" | "reference")
              }
              className={INPUT_CLASS}
            >
              <option value="copy">Copy wording</option>
              <option value="reference">Reference library item</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => onInsert(item, resumeText, relationship)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Add to resume
          </button>
        </div>
      </div>
    </article>
  );
}

function EditableList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <Field label={`${label} (comma-separated)`}>
      <input
        value={values.join(", ")}
        onChange={(event) => onChange(parseList(event.target.value))}
        className={INPUT_CLASS}
      />
    </Field>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTargetSection(type: CareerLibraryItemType): ResumeSectionId {
  switch (type) {
    case "experience":
      return "experience";
    case "accomplishment":
      return "experience";
    case "project":
      return "projects";
    case "skill":
      return "skills";
    case "summary":
      return "summary";
    case "education":
      return "education";
    case "certification":
      return "certifications";
  }
}

function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
