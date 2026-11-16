"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Module } from "@/components/features/module";
import type { SearchTerm } from "@/lib/search-preferences/model";
import type { SearchPreferences } from "@/lib/search-preferences/model";
import { createSearchPlan } from "@/lib/search-intelligence/query-planner";
import { SearchProfileSchema } from "@/lib/search-intelligence/model";
import { SearchStrategyDocumentSchema } from "@/lib/search-intelligence/api-model";
import type { SearchProfile } from "@/lib/search-intelligence/model";
import type { SearchStrategyDocument } from "@/lib/search-intelligence/api-model";
type TermDecision = "approved" | "rejected" | "deferred";

const BUTTON_CLASS =
  "rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

export function SearchStrategyDashboard({
  initialStrategy,
}: {
  initialStrategy: SearchStrategyDocument;
}) {
  const [strategy, setStrategy] = useState(initialStrategy);
  const [preferences, setPreferences] = useState(initialStrategy.preferences);
  const [revision, setRevision] = useState(initialStrategy.preferencesRevision);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newExclusion, setNewExclusion] = useState("");
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editingTermValue, setEditingTermValue] = useState("");

  const preview = useMemo(
    () => createPreview(strategy, preferences),
    [strategy, preferences],
  );
  const proposedCount = preview.searchProfile.terms.filter(
    (term) => term.status === "proposed",
  ).length;
  const approvedCount = preview.searchProfile.terms.filter(
    (term) => term.status === "approved" || term.status === "seed",
  ).length;

  function decideTerm(term: SearchTerm, status: TermDecision) {
    const updatedTerm = { ...term, status, updatedAt: new Date().toISOString() };
    setPreferences((current) => ({
      ...current,
      terms: upsertTerm(current.terms, updatedTerm),
    }));
    setSaveMessage("");
  }

  function decideRoleFamily(
    roleFamilyId: string,
    status: TermDecision,
    rationale: string,
  ) {
    setPreferences((current) => ({
      ...current,
      roleFamilyDecisions: [
        ...current.roleFamilyDecisions.filter(
          (decision) => decision.roleFamilyId !== roleFamilyId,
        ),
        {
          roleFamilyId,
          status,
          rationale,
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
    setSaveMessage("");
  }

  function addCustomTitle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newTitle.trim();
    if (!value) return;
    const timestamp = new Date().toISOString();
    const term: SearchTerm = {
      id: `custom-title-${crypto.randomUUID()}`,
      value,
      type: "title",
      status: "approved",
      source: "user",
      sourceReference: "user-created",
      triggeringInputs: [value],
      rationale: "Created and explicitly approved by the user.",
      confidence: 1,
      roleFamilyIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setPreferences((current) => ({
      ...current,
      terms: upsertTerm(current.terms, term),
    }));
    setNewTitle("");
    setSaveMessage("");
  }

  function addExclusion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newExclusion.trim();
    if (!value) return;
    setPreferences((current) => ({
      ...current,
      negativeKeywords: uniqueStrings([...current.negativeKeywords, value]),
    }));
    setNewExclusion("");
    setSaveMessage("");
  }

  function setSourceEnabled(providerId: string, enabled: boolean) {
    setPreferences((current) => ({
      ...current,
      sourcePreferences: [
        ...current.sourcePreferences.filter(
          (source) => source.providerId !== providerId,
        ),
        { providerId, enabled },
      ],
    }));
    setSaveMessage("");
  }

  function editTerm(term: SearchTerm) {
    const value = editingTermValue.trim();
    if (!value) return;
    const updated: SearchTerm = {
      ...term,
      value,
      status: "proposed",
      source: "user",
      sourceReference: "user-edited",
      triggeringInputs: [term.value],
      rationale: "Edited by the user; review before adding it to active searches.",
      updatedAt: new Date().toISOString(),
    };
    setPreferences((current) => ({
      ...current,
      terms: upsertTerm(current.terms, updated),
    }));
    setEditingTermId(null);
    setEditingTermValue("");
    setSaveMessage("");
  }

  async function savePreferences() {
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const response = await fetch(
        `/api/search-strategies/${encodeURIComponent(strategy.profileId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRevision: revision,
            preferences,
          }),
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, response.statusText));
      }
      const saved = SearchStrategyDocumentSchema.parse(payload);
      setStrategy(saved);
      setPreferences(saved.preferences);
      setRevision(saved.preferencesRevision);
      setSaveMessage("Search preferences saved. The plan preview is refreshed.");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save search preferences.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Search Intelligence · {strategy.profileId}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Search Strategy
          </h1>
          <p className="mt-2 max-w-3xl text-neutral-600 dark:text-neutral-400">
            Review how your career profile becomes a focused, editable search
            strategy. No jobs have been fetched and no provider searches have run.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Career profile
          </Link>
          <button
            type="button"
            onClick={savePreferences}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save search decisions"}
          </button>
        </div>
      </header>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100">
        Provenance: <strong>User</strong> means it came from you;{" "}
        <strong>Taxonomy</strong> means a configured taxonomy relationship;{" "}
        <strong>Recommendation</strong> means a generated suggestion. Proposed
        terms stay out of active queries until approved.
      </div>
      {saveError && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {saveError}
        </p>
      )}
      {saveMessage && (
        <p role="status" className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200">
          {saveMessage}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Module>
          <SectionHeading
            title="Your words"
            subtitle="Original career identity and user-authored inputs."
          />
          <p className="mt-4 text-lg font-semibold">
            {preview.searchProfile.userInput.targetIdentity}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {preview.searchProfile.userInput.name}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {preview.searchProfile.userInput.professionalDirection ||
              "No professional-direction statement provided."}
          </p>
          <InputGroup label="Seed titles" values={preview.searchProfile.userInput.seedTitles} />
          <InputGroup
            label="Preferred role families"
            values={preview.searchProfile.userInput.preferredRoleFamilies}
          />
          <InputGroup label="Primary skills" values={preview.searchProfile.primarySkills} />
          <InputGroup label="Transferable skills" values={preview.searchProfile.transferableSkills} />
          <InputGroup
            label="Desired responsibilities"
            values={preferences.desiredResponsibilities}
          />
        </Module>

        <Module>
          <SectionHeading
            title="Suggested role families"
            subtitle="Taxonomy relationships are recommendations, not automatic approvals."
          />
          <div className="mt-4 space-y-3">
            {preview.searchProfile.roleFamilies.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No taxonomy role-family match was found. Your original words remain available.
              </p>
            ) : (
              preview.searchProfile.roleFamilies.map((family) => (
                <div
                  key={family.roleFamilyId}
                  className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{family.label}</p>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs capitalize dark:bg-neutral-800">
                      {family.status} · {Math.round(family.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {family.rationale}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    From {family.triggeringInputs.join(", ") || family.sourceReference}
                    {family.driftWarning ? ` · ${family.driftWarning}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["approved", "rejected", "deferred"] as const).map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          className={BUTTON_CLASS}
                          aria-pressed={family.status === status}
                          onClick={() =>
                            decideRoleFamily(
                              family.roleFamilyId,
                              status,
                              `${status[0]?.toUpperCase()}${status.slice(1)} by the user.`,
                            )
                          }
                        >
                          {status[0]?.toUpperCase()}
                          {status.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Module>

        <Module className="lg:col-span-2">
          <SectionHeading
            title="Suggested titles"
            subtitle="Approve, reject, defer, or edit each generated title. Edits return to proposed status for review."
          />
          <div className="mt-4 space-y-3">
            {preview.searchProfile.terms
              .filter(
                (term) =>
                  term.type === "title" &&
                  term.status !== "seed",
              )
              .map((term) => (
                <div
                  key={term.id}
                  className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  {editingTermId === term.id ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        aria-label={`Edit ${term.value}`}
                        value={editingTermValue}
                        onChange={(event) =>
                          setEditingTermValue(event.target.value)
                        }
                        className="min-w-60 flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                      />
                      <button
                        type="button"
                        className={BUTTON_CLASS}
                        onClick={() => editTerm(term)}
                      >
                        Save edit
                      </button>
                      <button
                        type="button"
                        className={BUTTON_CLASS}
                        onClick={() => setEditingTermId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{term.value}</p>
                          <p className="mt-1 text-xs capitalize text-neutral-500">
                            {term.status} · {term.source} ·{" "}
                            {Math.round(term.confidence * 100)}% confidence
                          </p>
                        </div>
                        <button
                          type="button"
                          className={BUTTON_CLASS}
                          onClick={() => {
                            setEditingTermId(term.id);
                            setEditingTermValue(term.value);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                        {term.rationale}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Triggered by {term.triggeringInputs.join(", ") || "user decision"} ·{" "}
                        {term.sourceReference}
                      </p>
                      {term.driftWarning && (
                        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                          Drift warning: {term.driftWarning}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(["approved", "rejected", "deferred"] as const).map(
                          (status) => (
                            <button
                              key={status}
                              type="button"
                              className={BUTTON_CLASS}
                              aria-pressed={term.status === status}
                              onClick={() => decideTerm(term, status)}
                            >
                              {status[0]?.toUpperCase()}
                              {status.slice(1)}
                            </button>
                          ),
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            {preview.searchProfile.proposedTitles.length === 0 &&
              preview.searchProfile.approvedTitles.length === 0 &&
              preview.searchProfile.rejectedTitles.length === 0 &&
              preview.searchProfile.deferredTitles.length === 0 && (
                <p className="text-sm text-neutral-500">
                  No taxonomy title suggestions were found. Add your own title below.
                </p>
              )}
          </div>
          <form onSubmit={addCustomTitle} className="mt-4 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="custom-search-title">
              Add a custom title
            </label>
            <input
              id="custom-search-title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Add a custom title"
              className="min-w-60 flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            />
            <button type="submit" className={BUTTON_CLASS}>
              Add and approve title
            </button>
          </form>
        </Module>

        <Module>
          <SectionHeading
            title="Responsibilities"
            subtitle="Responsibility concepts that can guide matching."
          />
          <ReviewableTermList
            terms={[
              ...preview.searchProfile.responsibilities,
              ...preview.searchProfile.proposedResponsibilities,
            ]}
            onDecision={decideTerm}
          />
        </Module>

        <Module>
          <SectionHeading
            title="Suggested skills"
            subtitle="Related skills stay proposed until you approve them."
          />
          <ReviewableTermList
            terms={preview.searchProfile.proposedSkills}
            onDecision={decideTerm}
          />
        </Module>

        <Module>
          <SectionHeading
            title="Exclusions"
            subtitle="Negative keywords are applied to every planned query."
          />
          <ul className="mt-4 flex flex-wrap gap-2">
            {preview.searchProfile.negativeKeywords.map((keyword) => (
              <li
                key={keyword}
                className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-sm dark:border-neutral-800"
              >
                {keyword}
                <button
                  type="button"
                  aria-label={`Remove exclusion ${keyword}`}
                  onClick={() =>
                    setPreferences((current) => {
                      const updatedAt = new Date().toISOString();
                      return {
                        ...current,
                        negativeKeywords: current.negativeKeywords.filter(
                          (item) => item !== keyword,
                        ),
                        terms: current.terms.map((term) =>
                          term.type === "negative" &&
                          normalizeTerm(term.value) === normalizeTerm(keyword)
                            ? { ...term, status: "rejected", updatedAt }
                            : term,
                        ),
                      };
                    })
                  }
                  className="font-semibold text-neutral-500 hover:text-red-600"
                >
                  ×
                </button>
              </li>
            ))}
            {preview.searchProfile.excludedIndustries.map((industry) => (
              <li
                key={industry}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm dark:border-neutral-800"
              >
                Excluded industry · {industry}
              </li>
            ))}
          </ul>
          <form onSubmit={addExclusion} className="mt-4 flex gap-2">
            <label className="sr-only" htmlFor="negative-keyword">
              Add an exclusion
            </label>
            <input
              id="negative-keyword"
              value={newExclusion}
              onChange={(event) => setNewExclusion(event.target.value)}
              placeholder="Add a negative keyword"
              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            />
            <button type="submit" className={BUTTON_CLASS}>
              Add exclusion
            </button>
          </form>
        </Module>

        <Module className="lg:col-span-2">
          <SectionHeading
            title="Active Search Profile"
            subtitle="Only user seeds and explicitly approved terms enter planned queries."
          />
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium">
                {approvedCount} active terms · {proposedCount} proposed terms
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Locations:{" "}
                {preview.searchProfile.locationRules.preferredLocations
                  .map((location) => `${location.city}, ${location.region}`)
                  .join(" · ") || "Not specified"}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Work arrangement:{" "}
                {preview.searchProfile.workArrangement.preferredModes.join(
                  ", ",
                ) || "Not specified"}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Compensation:{" "}
                {formatCompensation(preview.searchProfile.compensationRules)}
              </p>
              <TermList
                terms={preview.searchProfile.terms.filter(
                  (term) =>
                    term.status === "seed" || term.status === "approved",
                )}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Planned query preview</p>
              <p className="mt-1 text-xs text-neutral-500">
                Preview only; no provider search has run.
              </p>
              <div className="mt-3 space-y-3">
                {preview.plan.queries.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    Approve at least one title or role family to create a query plan.
                  </p>
                ) : (
                  preview.plan.queries.map((query) => (
                    <div
                      key={query.id}
                      className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                    >
                      <p className="font-medium">{query.rationale}</p>
                      <p className="mt-2 text-sm">{query.terms.join(" · ")}</p>
                      {query.excludedTerms.length > 0 && (
                        <p className="mt-1 text-xs text-neutral-500">
                          Excluding {query.excludedTerms.join(", ")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Module>

        <Module className="lg:col-span-2">
          <SectionHeading
            title="Provider recommendations"
            subtitle="Recommendations use catalog metadata only; no provider APIs or websites are contacted."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {strategy.providerRecommendations.map((recommendation) => (
              <div
                key={recommendation.provider.id}
                className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {recommendation.provider.displayName}
                  </p>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs capitalize dark:bg-neutral-800">
                    {recommendation.status.replaceAll("-", " ")}
                  </span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
                  {recommendation.rationale.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-neutral-500">
                  Configured capabilities:{" "}
                  {recommendation.provider.capabilities.length
                    ? recommendation.provider.capabilities.join(", ")
                    : "None"}
                </p>
                <button
                  type="button"
                  className={`${BUTTON_CLASS} mt-3`}
                  aria-pressed={Boolean(
                    preferences.sourcePreferences.find(
                      (source) =>
                        source.providerId === recommendation.provider.id,
                    )?.enabled,
                  )}
                  onClick={() =>
                    setSourceEnabled(
                      recommendation.provider.id,
                      !preferences.sourcePreferences.find(
                        (source) =>
                          source.providerId === recommendation.provider.id,
                      )?.enabled,
                    )
                  }
                >
                  {preferences.sourcePreferences.find(
                    (source) =>
                      source.providerId === recommendation.provider.id,
                  )?.enabled
                    ? "Disable source"
                    : "Enable source"}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            {preview.searchProfile.sourcePreferences.length === 0
              ? "Providers unconfigured."
              : "Provider preferences are user-owned; adapters are not connected."}
          </p>
        </Module>
      </div>
    </main>
  );
}

function createPreview(
  strategy: SearchStrategyDocument,
  preferences: SearchPreferences,
): {
  searchProfile: SearchProfile;
  plan: ReturnType<typeof createSearchPlan>;
} {
  const terms = [...strategy.searchProfile.terms];
  for (const preferenceTerm of preferences.terms) {
    const existingIndex = terms.findIndex(
      (term) =>
        term.id === preferenceTerm.id ||
        (term.type === preferenceTerm.type &&
          normalizeTerm(term.value) === normalizeTerm(preferenceTerm.value)),
    );
    if (existingIndex < 0) {
      terms.push(preferenceTerm);
    } else {
      if (
        terms[existingIndex]?.status === "seed" &&
        preferenceTerm.status !== "seed"
      ) {
        continue;
      }
      terms[existingIndex] = preferenceTerm;
    }
  }
  const decisions = new Map(
    preferences.roleFamilyDecisions.map((decision) => [
      decision.roleFamilyId,
      decision,
    ]),
  );
  const roleFamilies = strategy.searchProfile.roleFamilies.map((family) => {
    const decision = decisions.get(family.roleFamilyId);
    return decision
      ? { ...family, status: decision.status, rationale: decision.rationale }
      : family;
  });
  const active = (term: SearchTerm) =>
    term.status === "seed" || term.status === "approved";
  const searchProfile = SearchProfileSchema.parse({
    ...strategy.searchProfile,
    userInput: {
      ...strategy.searchProfile.userInput,
      desiredResponsibilities: preferences.desiredResponsibilities,
      negativeKeywords: preferences.negativeKeywords,
    },
    terms,
    roleFamilies,
    approvedRoleFamilyIds: roleFamilies
      .filter((family) => family.status === "approved")
      .map((family) => family.roleFamilyId),
    seedTitles: terms.filter(
      (term) => term.type === "title" && term.status === "seed",
    ),
    approvedTitles: terms.filter(
      (term) =>
        term.type === "title" &&
        term.status === "approved",
    ),
    approvedAdjacentTitles: terms.filter(
      (term) =>
        term.type === "title" &&
        term.status === "approved" &&
        term.source !== "user",
    ),
    proposedTitles: terms.filter(
      (term) => term.type === "title" && term.status === "proposed",
    ),
    rejectedTitles: terms.filter(
      (term) => term.type === "title" && term.status === "rejected",
    ),
    deferredTitles: terms.filter(
      (term) => term.type === "title" && term.status === "deferred",
    ),
    responsibilities: terms.filter(
      (term) => term.type === "responsibility" && active(term),
    ),
    proposedResponsibilities: terms.filter(
      (term) =>
        term.type === "responsibility" && term.status === "proposed",
    ),
    primarySkills: strategy.searchProfile.primarySkills,
    transferableSkills: [
      ...strategy.searchProfile.userInput.transferableSkills,
      ...terms
        .filter(
          (term) =>
            term.type === "skill" &&
            term.status === "approved" &&
            !strategy.searchProfile.primarySkills.includes(term.value),
        )
        .map((term) => term.value),
    ],
    proposedSkills: terms.filter(
      (term) => term.type === "skill" && term.status === "proposed",
    ),
    negativeKeywords: uniqueStrings([
      ...preferences.negativeKeywords,
      ...terms
        .filter((term) => term.type === "negative" && active(term))
        .map((term) => term.value),
    ]),
    preferredIndustries: preferences.preferredIndustries,
    excludedIndustries: preferences.excludedIndustries,
    seniorityPreferences: preferences.seniorityPreferences,
    locationRules: {
      ...strategy.searchProfile.locationRules,
      preferredLocations:
        preferences.locationRules.preferredLocations.length > 0
          ? preferences.locationRules.preferredLocations
          : strategy.searchProfile.locationRules.preferredLocations,
      excludedLocations: preferences.locationRules.excludedLocations,
      willingToRelocate:
        preferences.locationRules.willingToRelocate ??
        strategy.searchProfile.locationRules.willingToRelocate,
    },
    compensationRules:
      Object.keys(preferences.compensationRules).length > 0
        ? preferences.compensationRules
        : strategy.searchProfile.compensationRules,
    workArrangement: {
      preferredModes:
        preferences.workArrangement.preferredModes.length > 0
          ? preferences.workArrangement.preferredModes
          : strategy.searchProfile.workArrangement.preferredModes,
    },
    workAuthorization: preferences.workAuthorization,
    sourcePreferences: preferences.sourcePreferences,
    queryPlanning: preferences.queryPlanning,
  });
  return {
    searchProfile,
    plan: createSearchPlan(
      searchProfile,
      new Date(strategy.plan.generatedAt),
    ),
  };
}

function TermList({ terms }: { terms: SearchTerm[] }) {
  if (terms.length === 0) {
    return <p className="mt-3 text-sm text-neutral-500">None configured.</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {terms.map((term) => (
        <li
          key={term.id}
          className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
        >
          <p className="text-sm font-medium">{term.value}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {term.status} · {term.source} · {term.rationale}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ReviewableTermList({
  terms,
  onDecision,
}: {
  terms: SearchTerm[];
  onDecision: (term: SearchTerm, status: TermDecision) => void;
}) {
  if (terms.length === 0) {
    return <p className="mt-3 text-sm text-neutral-500">None configured.</p>;
  }
  return (
    <ul className="mt-3 space-y-3">
      {terms.map((term) => (
        <li
          key={term.id}
          className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <p className="text-sm font-medium">{term.value}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {term.status} · {term.source} · {term.rationale}
          </p>
          {term.status !== "seed" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["approved", "rejected", "deferred"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={BUTTON_CLASS}
                  aria-pressed={term.status === status}
                  onClick={() => onDecision(term, status)}
                >
                  {status[0]?.toUpperCase()}
                  {status.slice(1)}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function InputGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-sm">
        {values.length ? values.join(" · ") : "Not configured."}
      </p>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {subtitle}
      </p>
    </>
  );
}

function upsertTerm(terms: SearchTerm[], updated: SearchTerm): SearchTerm[] {
  return [
    ...terms.filter(
      (term) =>
        term.id !== updated.id &&
        !(
          term.type === updated.type &&
          normalizeTerm(term.value) === normalizeTerm(updated.value)
        ),
    ),
    updated,
  ];
}

function normalizeTerm(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatCompensation(
  compensation: SearchProfile["compensationRules"],
): string {
  const { currency, minimumAnnual, maximumAnnual } = compensation;
  if (minimumAnnual === undefined && maximumAnnual === undefined) {
    return compensation.notes || "Not specified";
  }
  const formatter = new Intl.NumberFormat(undefined, {
    style: currency ? "currency" : "decimal",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  });
  return `${minimumAnnual === undefined ? "No minimum" : formatter.format(minimumAnnual)} – ${
    maximumAnnual === undefined ? "No maximum" : formatter.format(maximumAnnual)
  } annually`;
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback || "The search preferences could not be saved.";
}
