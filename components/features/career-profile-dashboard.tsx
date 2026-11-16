"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Pencil, ShieldCheck } from "lucide-react";
import { CareerProfileEditor } from "@/components/features/career-profile-editor";
import {
  CompensationRules,
  JobSourceManager,
  LocationRules,
  RoleFamilyList,
  SearchTermManager,
  SkillGroups,
  TargetRoleCard,
} from "@/components/features/career-profile-sections";
import { Module } from "@/components/features/module";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  CareerProfileDocumentSchema,
  CareerProfileSchema,
} from "@/lib/career-profile/model";
import type {
  CareerProfile,
  CareerProfileDocument,
} from "@/lib/career-profile/model";

const BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

export function CareerProfileDashboard({
  initialDocument,
  searchStrategySummary,
}: {
  initialDocument: CareerProfileDocument;
  searchStrategySummary: {
    approvedTermCount: number;
    proposedTermCount: number;
    providerRecommendationCount: number;
    queryCount: number;
    queryPreview: Array<{ rationale: string; terms: string[] }>;
  };
}) {
  const [document, setDocument] = useState(initialDocument);
  const [workingProfile, setWorkingProfile] = useState<CareerProfile | null>(
    null,
  );
  const [profileToApprove, setProfileToApprove] =
    useState<CareerProfile | null>(null);
  const [showApproval, setShowApproval] = useState(false);
  const [validationError, setValidationError] = useState("");
  const profile = document.profile;
  const editableProfile = workingProfile ?? profile;
  const isEditing = workingProfile !== null;

  function startEditing() {
    setWorkingProfile(structuredClone(profile));
    setValidationError("");
  }

  function cancelEditing() {
    setWorkingProfile(null);
    setProfileToApprove(null);
    setShowApproval(false);
    setValidationError("");
  }

  function updateWorkingProfile(updated: CareerProfile) {
    setWorkingProfile(updated);
    setValidationError("");
  }

  function requestApproval() {
    if (!workingProfile) return;
    const result = CareerProfileSchema.safeParse(workingProfile);
    if (!result.success) {
      setValidationError(
        result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      );
      return;
    }
    setProfileToApprove(result.data);
    setShowApproval(true);
    setValidationError("");
  }

  async function saveApprovedProfile() {
    if (!profileToApprove) return;
    const response = await fetch(
      `/api/career-profiles/${encodeURIComponent(profile.profileId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedRevision: document.revision,
          profile: profileToApprove,
        }),
      },
    );
    const payload: unknown = await response.json();
    if (!response.ok) {
      throw new Error(readErrorMessage(payload, response.statusText));
    }

    const savedDocument = CareerProfileDocumentSchema.parse(payload);
    setDocument(savedDocument);
    setWorkingProfile(null);
    setProfileToApprove(null);
    setValidationError("");
  }

  const markdownDownloadUrl = `/api/career-profiles/${encodeURIComponent(
    profile.profileId,
  )}?format=markdown`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Career profile · {profile.profileId}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {profile.name}
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Your editable source of truth for role, location, skills, and job
            search preferences.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={BUTTON_CLASS} href={markdownDownloadUrl}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export Markdown
          </a>
          {!isEditing ? (
            <button type="button" className={BUTTON_CLASS} onClick={startEditing}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit profile
            </button>
          ) : (
            <>
              <button
                type="button"
                className={BUTTON_CLASS}
                onClick={cancelEditing}
              >
                Discard edits
              </button>
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={requestApproval}
              >
                Review &amp; approve changes
              </button>
            </>
          )}
        </div>
      </header>

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          Changes are validated and saved to the Markdown profile only after
          you review and approve them. Generated terms remain inactive until
          individually approved.
        </p>
      </div>

      {validationError && (
        <p
          role="alert"
          className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          Profile validation failed: {validationError}
        </p>
      )}

      <Module className="mb-6">
        <Link
          href="/search-strategy"
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Search Intelligence
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {searchStrategySummary.proposedTermCount > 0
                  ? "Search strategy needs review"
                  : "Search strategy ready"}
              </h2>
            </div>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Review strategy →
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <span>
              {searchStrategySummary.approvedTermCount} active terms
            </span>
            <span>
              {searchStrategySummary.proposedTermCount} proposed terms
            </span>
            <span>
              {searchStrategySummary.providerRecommendationCount > 0
                ? `${searchStrategySummary.providerRecommendationCount} provider recommendations`
                : "Providers unconfigured"}
            </span>
            <span>{searchStrategySummary.queryCount} planned queries</span>
          </div>
          {searchStrategySummary.queryPreview.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {searchStrategySummary.queryPreview.map((query) => (
                <li key={query.rationale}>
                  <span className="font-medium">{query.rationale}</span>{" "}
                  <span className="text-neutral-500">
                    {query.terms.slice(0, 4).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Planning preview only; no provider searches have run.
          </p>
        </Link>
      </Module>

      {isEditing && (
        <Module className="mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Edit career profile</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Review these changes before approving them into the profile
              source.
            </p>
          </div>
          <CareerProfileEditor
            profile={editableProfile}
            onChange={updateWorkingProfile}
          />
        </Module>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <TargetRoleCard profile={editableProfile} />
        <RoleFamilyList profile={editableProfile} />
        <LocationRules profile={editableProfile} />
        <SkillGroups profile={editableProfile} />
        <CompensationRules profile={editableProfile} />
        <SearchTermManager
          profile={editableProfile}
          editable={isEditing}
          onChange={updateWorkingProfile}
        />
        <JobSourceManager
          profile={editableProfile}
          editable={isEditing}
          onChange={updateWorkingProfile}
        />
        <Module className="md:col-span-2 xl:col-span-3">
          <h2 className="text-lg font-semibold">Professional direction</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {editableProfile.professionalDirection || "Not configured."}
          </p>
        </Module>
      </div>

      <p className="mt-5 text-xs text-neutral-500 dark:text-neutral-400">
        {isEditing
          ? "Unsaved profile changes are staged in this page."
          : `Source revision ${document.revision.slice(0, 12)}`}
      </p>

      <ConfirmDialog
        open={showApproval}
        title="Approve profile changes?"
        description="The validated changes will be written to this profile's Markdown source. Generated search terms will only be active if you explicitly approved them in the term manager."
        confirmLabel="Approve & save"
        onConfirm={saveApprovedProfile}
        onCancel={() => {
          setShowApproval(false);
          setProfileToApprove(null);
        }}
      />
    </main>
  );
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
  return fallback || "The profile could not be saved.";
}
