"use client";

import { Children, useState } from "react";
import { Module } from "@/components/features/module";
import type { CareerProfile } from "@/lib/career-profile/model";

const MUTED_CLASS = "text-sm text-neutral-600 dark:text-neutral-400";
const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700";

export function TargetRoleCard({ profile }: { profile: CareerProfile }) {
  return (
    <Module>
      <h2 className="text-lg font-semibold">Target career identity</h2>
      <p className="mt-3 text-2xl font-semibold">{profile.targetIdentity}</p>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Career fit threshold: {profile.searchPreferences.minimumCareerFit}%
      </p>
    </Module>
  );
}

export function RoleFamilyList({ profile }: { profile: CareerProfile }) {
  return (
    <Module>
      <h2 className="text-lg font-semibold">Approved role families</h2>
      {profile.preferredRoleFamilies.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {profile.preferredRoleFamilies.map((family) => (
            <li
              key={family}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm dark:border-neutral-700"
            >
              {family}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-3 ${MUTED_CLASS}`}>No role families configured.</p>
      )}
    </Module>
  );
}

export function SkillGroups({ profile }: { profile: CareerProfile }) {
  return (
    <Module>
      <h2 className="text-lg font-semibold">Skills</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SkillList label="Primary" skills={profile.skills.primary} />
        <SkillList label="Secondary" skills={profile.skills.secondary} />
      </div>
    </Module>
  );
}

export function LocationRules({ profile }: { profile: CareerProfile }) {
  const { homeBase, additionalLocations, workModes, willingToRelocate } =
    profile.locations;
  return (
    <Module>
      <h2 className="text-lg font-semibold">Location preferences</h2>
      <p className="mt-3">
        {homeBase.city}, {homeBase.region} {homeBase.postalCode}
      </p>
      <p className={`mt-2 ${MUTED_CLASS}`}>
        Work modes: {workModes.length ? workModes.join(", ") : "Not specified"}
      </p>
      <p className={`mt-1 ${MUTED_CLASS}`}>
        Relocation:{" "}
        {willingToRelocate === undefined
          ? "Not specified"
          : willingToRelocate
            ? "Open"
            : "Not open"}
      </p>
      {additionalLocations.length > 0 && (
        <p className={`mt-1 ${MUTED_CLASS}`}>
          Other locations:{" "}
          {additionalLocations
            .map(
              (location) =>
                `${location.city}, ${location.region} ${location.postalCode}`,
            )
            .join("; ")}
        </p>
      )}
    </Module>
  );
}

export function CompensationRules({ profile }: { profile: CareerProfile }) {
  const { currency, minimumAnnual, maximumAnnual, notes } =
    profile.compensation;
  const hasRange =
    minimumAnnual !== undefined || maximumAnnual !== undefined;
  const formatter = new Intl.NumberFormat(undefined, {
    style: currency ? "currency" : "decimal",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  });
  return (
    <Module>
      <h2 className="text-lg font-semibold">Compensation rules</h2>
      {hasRange ? (
        <p className="mt-3">
          {minimumAnnual === undefined
            ? "No minimum"
            : formatter.format(minimumAnnual)}
          {" – "}
          {maximumAnnual === undefined
            ? "No maximum"
            : formatter.format(maximumAnnual)}
          {" annually"}
        </p>
      ) : (
        <p className={`mt-3 ${MUTED_CLASS}`}>Not configured.</p>
      )}
      {notes && <p className={`mt-2 ${MUTED_CLASS}`}>{notes}</p>}
    </Module>
  );
}

export function SearchTermManager({
  profile,
  editable,
  onChange,
}: {
  profile: CareerProfile;
  editable: boolean;
  onChange: (profile: CareerProfile) => void;
}) {
  const [termInput, setTermInput] = useState("");
  const [sourceInput, setSourceInput] = useState<"taxonomy" | "ai">("taxonomy");
  const seeds = profile.seedTitles;
  const terms = profile.searchTerms;

  function setTermStatus(id: string, status: CareerProfile["searchTerms"][number]["status"]) {
    onChange({
      ...profile,
      searchTerms: profile.searchTerms.map((term) =>
        term.id === id ? { ...term, status } : term,
      ),
    });
  }

  function addTerm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = termInput.trim();
    if (!term) return;
    onChange({
      ...profile,
      searchTerms: [
        ...profile.searchTerms,
        {
          id: crypto.randomUUID(),
          term,
          source: sourceInput,
          status: "pending",
        },
      ],
    });
    setTermInput("");
  }

  return (
    <Module className="md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Search term manager</h2>
          <p className={`mt-1 ${MUTED_CLASS}`}>
            Suggested terms stay inactive until you approve them.
          </p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs dark:bg-neutral-800">
          {profile.searchPreferences.allowGeneratedTerms
            ? "Suggestions allowed"
            : "Generated suggestions off"}
        </span>
      </div>
      <TermGroup title="User seed terms" empty="No seed titles configured.">
        {seeds.map((term) => (
          <TermPill key={`seed:${term}`} term={term} label="Seed · active" />
        ))}
      </TermGroup>
      {(["taxonomy", "ai"] as const).map((source) => {
        const sourceTerms = terms.filter((term) => term.source === source);
        return (
          <TermGroup
            key={source}
            title={`${source === "ai" ? "AI-derived" : "Taxonomy-derived"} suggestions`}
            empty={`No ${source === "ai" ? "AI" : "taxonomy"} suggestions.`}
          >
            {sourceTerms.map((term) => (
              <div
                key={term.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800"
              >
                <div>
                  <p className="font-medium">{term.term}</p>
                  <p className="text-xs capitalize text-neutral-500 dark:text-neutral-400">
                    {term.status} · {source}
                  </p>
                </div>
                {editable && (
                  <div className="flex flex-wrap gap-2">
                    {term.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => setTermStatus(term.id, "approved")}
                        className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Approve
                      </button>
                    )}
                    {term.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => setTermStatus(term.id, "rejected")}
                        className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700"
                      >
                        Reject
                      </button>
                    )}
                    {term.status !== "deferred" && (
                      <button
                        type="button"
                        onClick={() => setTermStatus(term.id, "deferred")}
                        className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700"
                      >
                        Defer
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </TermGroup>
        );
      })}
      {editable && profile.searchPreferences.allowGeneratedTerms && (
        <form
          onSubmit={addTerm}
          className="mt-5 grid gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:grid-cols-[1fr_auto_auto]"
        >
          <label className="sr-only" htmlFor="career-profile-new-term">
            New suggested search term
          </label>
          <input
            id="career-profile-new-term"
            className={INPUT_CLASS}
            value={termInput}
            onChange={(event) => setTermInput(event.target.value)}
            placeholder="Add a suggested term"
          />
          <label className="sr-only" htmlFor="career-profile-term-source">
            Suggestion source
          </label>
          <select
            id="career-profile-term-source"
            className={INPUT_CLASS}
            value={sourceInput}
            onChange={(event) =>
              setSourceInput(event.target.value as "taxonomy" | "ai")
            }
          >
            <option value="taxonomy">Taxonomy</option>
            <option value="ai">AI-derived</option>
          </select>
          <button
            type="submit"
            className="mt-1 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Add pending
          </button>
        </form>
      )}
      <p className={`mt-3 ${MUTED_CLASS}`}>
        Pending, deferred, and rejected generated terms are never active.
        Approval changes are staged until the profile is saved. Search-term
        generation is not connected yet; this manager edits supplied
        suggestions and their recorded source and approval state.
      </p>
    </Module>
  );
}

export function JobSourceManager({
  profile,
  editable,
  onChange,
}: {
  profile: CareerProfile;
  editable: boolean;
  onChange: (profile: CareerProfile) => void;
}) {
  const [providerName, setProviderName] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [geographicRelevance, setGeographicRelevance] = useState("");
  const [industryRelevance, setIndustryRelevance] = useState("");
  const [recommendationReason, setRecommendationReason] = useState("");
  const [status, setStatus] =
    useState<CareerProfile["jobSources"][number]["status"]>("planned");

  function addProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = providerName.trim();
    if (!name) return;
    const providerId = `${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
    onChange({
      ...profile,
      jobSources: [
        ...profile.jobSources,
        {
          providerId,
          providerName: name,
          enabled: false,
          capabilities: capabilities
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          geographicRelevance,
          industryRelevance,
          status,
          recommendationReason,
        },
      ],
    });
    setProviderName("");
    setCapabilities("");
    setGeographicRelevance("");
    setIndustryRelevance("");
    setRecommendationReason("");
  }

  function updateProvider(
    providerId: string,
    update: Partial<CareerProfile["jobSources"][number]>,
  ) {
    onChange({
      ...profile,
      jobSources: profile.jobSources.map((source) =>
        source.providerId === providerId ? { ...source, ...update } : source,
      ),
    });
  }

  return (
    <Module className="md:col-span-2">
      <h2 className="text-lg font-semibold">Job source manager</h2>
      <p className={`mt-1 ${MUTED_CLASS}`}>
        These are profile preferences, not live search connections. Provider
        discovery and adapters are not connected yet.
      </p>
      {profile.jobSources.length ? (
        <div className="mt-4 space-y-3">
          {profile.jobSources.map((source) => (
            <article
              key={source.providerId}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {editable ? (
                    <label className="block text-sm font-medium">
                      Provider name
                      <input
                        className={INPUT_CLASS}
                        value={source.providerName}
                        onChange={(event) =>
                          updateProvider(source.providerId, {
                            providerName: event.target.value,
                          })
                        }
                      />
                    </label>
                  ) : (
                    <h3 className="font-semibold">{source.providerName}</h3>
                  )}
                  <p className="mt-1 text-xs capitalize text-neutral-500 dark:text-neutral-400">
                    {source.status} · {source.providerId}
                  </p>
                </div>
                {editable && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={source.enabled}
                      disabled={source.status === "unavailable"}
                      onChange={(event) =>
                        updateProvider(source.providerId, {
                          enabled: event.target.checked,
                        })
                      }
                    />
                    Enabled
                  </label>
                )}
                {!editable && (
                  <span className="text-sm">
                    {source.enabled ? "Enabled" : "Disabled"}
                  </span>
                )}
              </div>
              {editable ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Capabilities (comma separated)
                    <input
                      className={INPUT_CLASS}
                      value={source.capabilities.join(", ")}
                      onChange={(event) =>
                        updateProvider(source.providerId, {
                          capabilities: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Status
                    <select
                      className={INPUT_CLASS}
                      value={source.status}
                      onChange={(event) => {
                        const nextStatus =
                          event.target
                            .value as CareerProfile["jobSources"][number]["status"];
                        updateProvider(source.providerId, {
                          status: nextStatus,
                          ...(nextStatus === "unavailable"
                            ? { enabled: false }
                            : {}),
                        });
                      }}
                    >
                      <option value="planned">Planned</option>
                      <option value="available">Available</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Geographic relevance
                    <input
                      className={INPUT_CLASS}
                      value={source.geographicRelevance}
                      onChange={(event) =>
                        updateProvider(source.providerId, {
                          geographicRelevance: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Industry relevance
                    <input
                      className={INPUT_CLASS}
                      value={source.industryRelevance}
                      onChange={(event) =>
                        updateProvider(source.providerId, {
                          industryRelevance: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium sm:col-span-2">
                    Why recommended
                    <textarea
                      className={INPUT_CLASS}
                      rows={2}
                      value={source.recommendationReason}
                      onChange={(event) =>
                        updateProvider(source.providerId, {
                          recommendationReason: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              ) : (
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <Description
                    label="Capabilities"
                    value={source.capabilities.join(", ")}
                  />
                  <Description
                    label="Geographic relevance"
                    value={source.geographicRelevance}
                  />
                  <Description
                    label="Industry relevance"
                    value={source.industryRelevance}
                  />
                  <Description
                    label="Why recommended"
                    value={source.recommendationReason}
                  />
                </dl>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className={`mt-4 ${MUTED_CLASS}`}>
          No source providers are configured for this profile.
        </p>
      )}
      {editable && (
        <form
          onSubmit={addProvider}
          className="mt-5 grid gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:grid-cols-2"
        >
          <h3 className="sm:col-span-2 text-sm font-semibold">
            Add provider preference
          </h3>
          <label className="block text-sm font-medium">
            Provider name
            <input
              className={INPUT_CLASS}
              value={providerName}
              onChange={(event) => setProviderName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Status
            <select
              className={INPUT_CLASS}
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as CareerProfile["jobSources"][number]["status"],
                )
              }
            >
              <option value="planned">Planned</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Capabilities (comma separated)
            <input
              className={INPUT_CLASS}
              value={capabilities}
              onChange={(event) => setCapabilities(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Geographic relevance
            <input
              className={INPUT_CLASS}
              value={geographicRelevance}
              onChange={(event) => setGeographicRelevance(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Industry relevance
            <input
              className={INPUT_CLASS}
              value={industryRelevance}
              onChange={(event) => setIndustryRelevance(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Why recommended
            <input
              className={INPUT_CLASS}
              value={recommendationReason}
              onChange={(event) => setRecommendationReason(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 sm:col-span-2"
          >
            Add source preference
          </button>
        </form>
      )}
    </Module>
  );
}

function SkillList({ label, skills }: { label: string; skills: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </h3>
      {skills.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li
              key={skill}
              className="rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-800"
            >
              {skill}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-2 ${MUTED_CLASS}`}>Not configured.</p>
      )}
    </div>
  );
}

function TermGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {Children.count(children) > 0 ? (
          children
        ) : (
          <p className={MUTED_CLASS}>{empty}</p>
        )}
      </div>
    </section>
  );
}

function TermPill({ term, label }: { term: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-sm dark:border-neutral-700">
      {term}
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
    </span>
  );
}

function Description({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd className="mt-0.5 text-neutral-600 dark:text-neutral-400">
        {value || "Not specified"}
      </dd>
    </div>
  );
}
