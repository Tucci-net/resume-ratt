"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { AccordionSection } from "@/components/features/accordion-section";
import { useCareerLibrary } from "@/hooks/use-career-library";
import {
  parseCareerLibraryJson,
  parseCareerLibraryMarkdown,
  serializeCareerLibraryJson,
  serializeCareerLibraryMarkdown,
} from "@/lib/career-library/format";
import { mergeCareerLibraryItems } from "@/lib/career-library/merge";
import { splitResumeItems } from "@/lib/resume/format";
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
}: {
  resume: ResumeContent;
  setResume: Dispatch<SetStateAction<ResumeContent>>;
}) {
  const {
    items,
    isLoaded,
    recoveryRequired,
    error,
    setError,
    updateItems,
    startFreshAfterRecovery,
  } = useCareerLibrary();
  const [newType, setNewType] =
    useState<CareerLibraryItemType>("accomplishment");
  const [newText, setNewText] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newSkills, setNewSkills] = useState("");
  const [newMetrics, setNewMetrics] = useState("");
  const [newSource, setNewSource] = useState("");
  const [notice, setNotice] = useState("");

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
      tags: parseList(newTags),
      skills: parseList(newSkills),
      metrics: parseList(newMetrics),
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
    setError("");
    setNotice("Added to the Career Library.");
  }

  function updateItem(id: string, patch: Partial<CareerLibraryItem>) {
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
    };

    setResume((current) => {
      let updated: ResumeContent = { ...current };
      switch (item.type) {
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
                id: crypto.randomUUID(),
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
                id: crypto.randomUUID(),
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
                id: crypto.randomUUID(),
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
      const { added, skipped } = mergeCareerLibraryItems(items, imported);
      updateItems((current) => mergeCareerLibraryItems(current, imported).items);
      setError("");
      setNotice(
        `Imported ${added} item${added === 1 ? "" : "s"}; skipped ${skipped} existing ID${skipped === 1 ? "" : "s"} without overwriting them.`,
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The Career Library file could not be imported.",
      );
    }
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
        title={<span className="text-lg font-semibold">Career Library</span>}
        description="Save canonical career facts and reuse resume-specific wording across drafts."
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
                  <h3 className="text-sm font-semibold">Used in this resume</h3>
                  <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
                    {resume.careerLibraryReferences.map((reference, index) => (
                      <li key={`${reference.libraryItemId}-${index}`}>
                        {reference.relationship} · {reference.type} ·{" "}
                        {reference.resumeText}
                      </li>
                    ))}
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
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Updated {new Date(item.updatedAt).toLocaleString()}
      </p>
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
