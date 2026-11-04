"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AccordionSection } from "@/components/features/accordion-section";
import type {
  ResumeCertification,
  ResumeContent,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
} from "@/lib/resume/model";
import { addResumeEntry, removeResumeEntry } from "@/lib/resume/sections";

const inputClassName =
  "mt-1.5 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700";

export function ResumeContentEditor({
  resume,
  setResume,
}: {
  resume: ResumeContent;
  setResume: Dispatch<SetStateAction<ResumeContent>>;
}) {
  function update<K extends keyof ResumeContent>(
    key: K,
    value: ResumeContent[K],
  ) {
    setResume((current) => ({ ...current, [key]: value }));
  }

  function updateExperience<K extends keyof ResumeExperience>(
    id: string,
    field: K,
    value: ResumeExperience[K],
  ) {
    setResume((current) => ({
      ...current,
      experience: current.experience.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function updateEducation<K extends keyof ResumeEducation>(
    id: string,
    field: K,
    value: ResumeEducation[K],
  ) {
    setResume((current) => ({
      ...current,
      education: current.education.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function updateProject<K extends keyof ResumeProject>(
    id: string,
    field: K,
    value: ResumeProject[K],
  ) {
    setResume((current) => ({
      ...current,
      projects: current.projects.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function updateCertification<K extends keyof ResumeCertification>(
    id: string,
    field: K,
    value: ResumeCertification[K],
  ) {
    setResume((current) => ({
      ...current,
      certifications: current.certifications.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  }

  return (
    <>
      <EditorSection
          className="resume-editor-section px-5 py-5 sm:px-6"
          title="Your details"
          count={Number(Boolean(resume.name || resume.headline || resume.email))}
          emptyText="Start with the information you want employers to see."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" className="sm:col-span-2">
              <input
                autoComplete="name"
                value={resume.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Jordan Lee"
                className={inputClassName}
              />
            </Field>
            <Field label="Professional headline" className="sm:col-span-2">
              <input
                value={resume.headline}
                onChange={(event) => update("headline", event.target.value)}
                placeholder="Product designer"
                className={inputClassName}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                value={resume.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="jordan@example.com"
                className={inputClassName}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                autoComplete="tel"
                value={resume.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="(555) 123-4567"
                className={inputClassName}
              />
            </Field>
            <Field label="Location">
              <input
                autoComplete="address-level2"
                value={resume.location}
                onChange={(event) => update("location", event.target.value)}
                placeholder="Seattle, WA"
                className={inputClassName}
              />
            </Field>
            <Field label="Website or LinkedIn">
              <input
                type="url"
                value={resume.website}
                onChange={(event) => update("website", event.target.value)}
                placeholder="https://linkedin.com/in/jordanlee"
                className={inputClassName}
              />
            </Field>
            <Field label="Summary" className="sm:col-span-2">
              <textarea
                rows={4}
                value={resume.summary}
                onChange={(event) => update("summary", event.target.value)}
                placeholder="A few sentences about your experience, strengths, and the work you want to do."
                className={inputClassName}
              />
            </Field>
          </div>
      </EditorSection>

      <EditorSection
          className="resume-editor-section px-5 py-5 sm:px-6"
          title="Experience"
          count={resume.experience.length}
          emptyText="Add roles and accomplishments, newest first."
          onAdd={() =>
            setResume((current) => ({
              ...current,
              experience: addResumeEntry(current.experience, {
                id: crypto.randomUUID(),
                employer: "",
                jobTitle: "",
                location: "",
                startDate: "",
                endDate: "",
                currentRole: false,
                accomplishments: [],
              }),
            }))
          }
          addLabel="Add role"
        >
          {resume.experience.map((item, index) => (
            <EntryCard
              key={item.id}
              title={item.jobTitle.trim() || item.employer.trim() || `Role ${index + 1}`}
              onRemove={() =>
                setResume((current) => ({
                  ...current,
                  experience: removeResumeEntry(current.experience, item.id),
                }))
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Job title">
                  <input
                    value={item.jobTitle}
                    onChange={(event) =>
                      updateExperience(item.id, "jobTitle", event.target.value)
                    }
                    placeholder="Senior designer"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Employer">
                  <input
                    value={item.employer}
                    onChange={(event) =>
                      updateExperience(item.id, "employer", event.target.value)
                    }
                    placeholder="Company name"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={item.location}
                    onChange={(event) =>
                      updateExperience(item.id, "location", event.target.value)
                    }
                    placeholder="Seattle, WA"
                    className={inputClassName}
                  />
                </Field>
                <DateRange
                  startDate={item.startDate}
                  endDate={item.endDate}
                  current={item.currentRole}
                  currentLabel="I currently work here"
                  endLabel="End date"
                  onStartChange={(value) =>
                    updateExperience(item.id, "startDate", value)
                  }
                  onEndChange={(value) =>
                    updateExperience(item.id, "endDate", value)
                  }
                  onCurrentChange={(value) =>
                    updateExperience(item.id, "currentRole", value)
                  }
                />
                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Accomplishments</p>
                    <button
                      type="button"
                      onClick={() =>
                        updateExperience(item.id, "accomplishments", [
                          ...item.accomplishments,
                          "",
                        ])
                      }
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add bullet
                    </button>
                  </div>
                  {item.accomplishments.map((bullet, bulletIndex) => (
                    <BulletEditor
                      key={`${item.id}-bullet-${bulletIndex}`}
                      value={bullet}
                      index={bulletIndex}
                      total={item.accomplishments.length}
                      onChange={(value) =>
                        updateExperience(
                          item.id,
                          "accomplishments",
                          item.accomplishments.map((entry, currentIndex) =>
                            currentIndex === bulletIndex ? value : entry,
                          ),
                        )
                      }
                      onRemove={() =>
                        updateExperience(
                          item.id,
                          "accomplishments",
                          item.accomplishments.filter(
                            (_, currentIndex) => currentIndex !== bulletIndex,
                          ),
                        )
                      }
                      onMove={(direction) =>
                        updateExperience(
                          item.id,
                          "accomplishments",
                          moveItem(item.accomplishments, bulletIndex, direction),
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            </EntryCard>
          ))}
      </EditorSection>

      <EditorSection
          className="resume-editor-section px-5 py-5 sm:px-6"
          title="Education"
          count={resume.education.length}
          emptyText="Add schools, degrees, or other education."
          onAdd={() =>
            setResume((current) => ({
              ...current,
              education: addResumeEntry(current.education, {
                id: crypto.randomUUID(),
                institution: "",
                degree: "",
                fieldOfStudy: "",
                location: "",
                startDate: "",
                endDate: "",
                currentlyEnrolled: false,
                gpa: "",
                honors: "",
              }),
            }))
          }
          addLabel="Add education"
        >
          {resume.education.map((item, index) => (
            <EntryCard
              key={item.id}
              title={
                item.institution.trim() || item.degree.trim() || `Education ${index + 1}`
              }
              onRemove={() =>
                setResume((current) => ({
                  ...current,
                  education: removeResumeEntry(current.education, item.id),
                }))
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="School / institution" className="sm:col-span-2">
                  <input
                    value={item.institution}
                    onChange={(event) =>
                      updateEducation(item.id, "institution", event.target.value)
                    }
                    placeholder="University name"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Degree">
                  <input
                    value={item.degree}
                    onChange={(event) =>
                      updateEducation(item.id, "degree", event.target.value)
                    }
                    placeholder="Bachelor of Science"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Field of study">
                  <input
                    value={item.fieldOfStudy}
                    onChange={(event) =>
                      updateEducation(item.id, "fieldOfStudy", event.target.value)
                    }
                    placeholder="Computer Science"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={item.location}
                    onChange={(event) =>
                      updateEducation(item.id, "location", event.target.value)
                    }
                    placeholder="Boston, MA"
                    className={inputClassName}
                  />
                </Field>
                <DateRange
                  startDate={item.startDate}
                  endDate={item.endDate}
                  current={item.currentlyEnrolled}
                  currentLabel="Currently enrolled"
                  endLabel="Graduation / expected date"
                  onStartChange={(value) =>
                    updateEducation(item.id, "startDate", value)
                  }
                  onEndChange={(value) =>
                    updateEducation(item.id, "endDate", value)
                  }
                  onCurrentChange={(value) =>
                    updateEducation(item.id, "currentlyEnrolled", value)
                  }
                />
                <Field label="GPA (optional)">
                  <input
                    value={item.gpa}
                    onChange={(event) =>
                      updateEducation(item.id, "gpa", event.target.value)
                    }
                    placeholder="3.8 / 4.0"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Honors / additional details" className="sm:col-span-2">
                  <textarea
                    rows={2}
                    value={item.honors}
                    onChange={(event) =>
                      updateEducation(item.id, "honors", event.target.value)
                    }
                    placeholder="Dean's List, honors program..."
                    className={inputClassName}
                  />
                </Field>
              </div>
            </EntryCard>
          ))}
      </EditorSection>

      <EditorSection
          className="resume-editor-section px-5 py-5 sm:px-6"
          title="Projects"
          count={resume.projects.length}
          emptyText="Add projects that highlight your work."
          onAdd={() =>
            setResume((current) => ({
              ...current,
              projects: addResumeEntry(current.projects, {
                id: crypto.randomUUID(),
                name: "",
                subtitle: "",
                startDate: "",
                endDate: "",
                url: "",
                description: "",
                accomplishments: [],
              }),
            }))
          }
          addLabel="Add project"
        >
          {resume.projects.map((item, index) => (
            <EntryCard
              key={item.id}
              title={item.name.trim() || item.subtitle.trim() || `Project ${index + 1}`}
              onRemove={() =>
                setResume((current) => ({
                  ...current,
                  projects: removeResumeEntry(current.projects, item.id),
                }))
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project name">
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateProject(item.id, "name", event.target.value)
                    }
                    placeholder="Open source dashboard"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Role / subtitle">
                  <input
                    value={item.subtitle}
                    onChange={(event) =>
                      updateProject(item.id, "subtitle", event.target.value)
                    }
                    placeholder="Designer and maintainer"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Start date">
                  <input
                    value={item.startDate}
                    onChange={(event) =>
                      updateProject(item.id, "startDate", event.target.value)
                    }
                    placeholder="2024"
                    className={inputClassName}
                  />
                </Field>
                <Field label="End date">
                  <input
                    value={item.endDate}
                    onChange={(event) =>
                      updateProject(item.id, "endDate", event.target.value)
                    }
                    placeholder="Present"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Project URL" className="sm:col-span-2">
                  <input
                    type="url"
                    value={item.url}
                    onChange={(event) =>
                      updateProject(item.id, "url", event.target.value)
                    }
                    placeholder="https://example.com"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Description" className="sm:col-span-2">
                  <textarea
                    rows={3}
                    value={item.description}
                    onChange={(event) =>
                      updateProject(item.id, "description", event.target.value)
                    }
                    placeholder="What the project does and who it serves."
                    className={inputClassName}
                  />
                </Field>
                <BulletFields
                  title="Accomplishments"
                  bullets={item.accomplishments}
                  onChange={(accomplishments) =>
                    updateProject(item.id, "accomplishments", accomplishments)
                  }
                />
              </div>
            </EntryCard>
          ))}
      </EditorSection>

      <EditorSection
          className="resume-editor-section px-5 py-5 sm:px-6"
          title="Skills"
          count={itemCount(resume.skills)}
          emptyText="Separate skills with commas or new lines."
        >
          <Field label="Skills" hint="Use commas or new lines between skills.">
            <textarea
              rows={3}
              value={resume.skills}
              onChange={(event) => update("skills", event.target.value)}
              placeholder="Research, Figma, Prototyping"
              className={inputClassName}
            />
          </Field>
      </EditorSection>

      <EditorSection
          className="resume-editor-section px-5 py-5 sm:px-6"
          title="Certifications"
          count={resume.certifications.length}
          emptyText="Add licenses and certifications."
          onAdd={() =>
            setResume((current) => ({
              ...current,
              certifications: addResumeEntry(current.certifications, {
                id: crypto.randomUUID(),
                name: "",
                issuer: "",
                issueDate: "",
                expirationDate: "",
                credentialId: "",
                credentialUrl: "",
              }),
            }))
          }
          addLabel="Add certification"
        >
          {resume.certifications.map((item, index) => (
            <EntryCard
              key={item.id}
              title={item.name.trim() || `Certification ${index + 1}`}
              onRemove={() =>
                setResume((current) => ({
                  ...current,
                  certifications: removeResumeEntry(
                    current.certifications,
                    item.id,
                  ),
                }))
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Certification name">
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateCertification(item.id, "name", event.target.value)
                    }
                    placeholder="Professional certification"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Issuing organization">
                  <input
                    value={item.issuer}
                    onChange={(event) =>
                      updateCertification(item.id, "issuer", event.target.value)
                    }
                    placeholder="Issuing organization"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Issue date">
                  <input
                    value={item.issueDate}
                    onChange={(event) =>
                      updateCertification(item.id, "issueDate", event.target.value)
                    }
                    placeholder="May 2024"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Expiration date (optional)">
                  <input
                    value={item.expirationDate}
                    onChange={(event) =>
                      updateCertification(
                        item.id,
                        "expirationDate",
                        event.target.value,
                      )
                    }
                    placeholder="May 2027"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Credential ID (optional)">
                  <input
                    value={item.credentialId}
                    onChange={(event) =>
                      updateCertification(
                        item.id,
                        "credentialId",
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Credential URL (optional)">
                  <input
                    type="url"
                    value={item.credentialUrl}
                    onChange={(event) =>
                      updateCertification(
                        item.id,
                        "credentialUrl",
                        event.target.value,
                      )
                    }
                    placeholder="https://example.com/verify"
                    className={inputClassName}
                  />
                </Field>
              </div>
            </EntryCard>
          ))}
      </EditorSection>
    </>
  );
}

function itemCount(value: string): number {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function EditorSection({
  className,
  title,
  count,
  emptyText,
  addLabel,
  onAdd,
  children,
}: {
  className: string;
  title: string;
  count: number;
  emptyText: string;
  addLabel?: string;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <AccordionSection
      className={className}
      defaultOpen
      title={<span className="text-lg font-semibold">{title}</span>}
      description={
        count === 0
          ? emptyText
          : `${count} ${count === 1 ? "item" : "items"}`
      }
    >
      <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mb-4 inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        )}
        {children}
      </div>
    </AccordionSection>
  );
}

function EntryCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <AccordionSection
      title={<span className="text-sm font-medium">{title}</span>}
      className="mt-4 rounded-lg border border-neutral-200 p-3 first:mt-0 dark:border-neutral-800"
    >
      <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
        {children}
      </div>
    </AccordionSection>
  );
}

function DateRange({
  startDate,
  endDate,
  current,
  currentLabel,
  endLabel,
  onStartChange,
  onEndChange,
  onCurrentChange,
}: {
  startDate: string;
  endDate: string;
  current: boolean;
  currentLabel: string;
  endLabel: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onCurrentChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Start date">
        <input
          value={startDate}
          onChange={(event) => onStartChange(event.target.value)}
          placeholder="2022"
          className={inputClassName}
        />
      </Field>
      <Field label={endLabel}>
        <input
          value={endDate}
          onChange={(event) => onEndChange(event.target.value)}
          disabled={current && endLabel === "End date"}
          placeholder={current ? "Expected 2026" : "2025"}
          className={inputClassName}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={current}
          onChange={(event) => onCurrentChange(event.target.checked)}
          className="accent-blue-600"
        />
        {currentLabel}
      </label>
    </div>
  );
}

function BulletFields({
  title,
  bullets,
  onChange,
}: {
  title: string;
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <button
          type="button"
          onClick={() => onChange([...bullets, ""])}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Add bullet
        </button>
      </div>
      {bullets.map((bullet, index) => (
        <BulletEditor
          key={`bullet-${index}`}
          value={bullet}
          index={index}
          total={bullets.length}
          onChange={(value) =>
            onChange(bullets.map((item, current) => (current === index ? value : item)))
          }
          onRemove={() => onChange(bullets.filter((_, current) => current !== index))}
          onMove={(direction) => onChange(moveItem(bullets, index, direction))}
        />
      ))}
    </div>
  );
}

function BulletEditor({
  value,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  value: string;
  index: number;
  total: number;
  onChange: (value: string) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <textarea
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`Accomplishment ${index + 1}`}
        placeholder="Describe an accomplishment"
        className={inputClassName}
      />
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Move accomplishment ${index + 1} up`}
          className="rounded px-1 text-neutral-500 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={`Move accomplishment ${index + 1} down`}
          className="rounded px-1 text-neutral-500 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove accomplishment ${index + 1}`}
          className="rounded p-1 text-neutral-500 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const reordered = [...items];
  [reordered[index], reordered[targetIndex]] = [
    reordered[targetIndex]!,
    reordered[index]!,
  ];
  return reordered;
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      {label}
      {children}
      {hint && (
        <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
          {hint}
        </span>
      )}
    </label>
  );
}
