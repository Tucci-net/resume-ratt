"use client";

import type { CareerProfile } from "@/lib/career-profile/model";

const FIELD_CLASS =
  "mt-1.5 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700";

export function CareerProfileEditor({
  profile,
  onChange,
}: {
  profile: CareerProfile;
  onChange: (profile: CareerProfile) => void;
}) {
  function updateList(
    group: "skills",
    key: "primary" | "secondary",
    value: string,
  ) {
    onChange({
      ...profile,
      [group]: { ...profile[group], [key]: splitLines(value) },
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Profile name
          <input
            className={FIELD_CLASS}
            value={profile.name}
            onChange={(event) =>
              onChange({ ...profile, name: event.target.value })
            }
          />
        </label>
        <label className="block text-sm font-medium">
          Target career identity
          <input
            className={FIELD_CLASS}
            value={profile.targetIdentity}
            onChange={(event) =>
              onChange({ ...profile, targetIdentity: event.target.value })
            }
          />
        </label>
        <label className="block text-sm font-medium">
          Minimum career fit (0–100)
          <input
            className={FIELD_CLASS}
            type="number"
            min={0}
            max={100}
            value={profile.searchPreferences.minimumCareerFit}
            onChange={(event) =>
              onChange({
                ...profile,
                searchPreferences: {
                  ...profile.searchPreferences,
                  minimumCareerFit: Number(event.target.value),
                },
              })
            }
          />
        </label>
      </div>

      <TextListField
        label="Preferred role families"
        value={profile.preferredRoleFamilies}
        onChange={(value) =>
          onChange({ ...profile, preferredRoleFamilies: value })
        }
      />
      <TextListField
        label="Seed job titles"
        value={profile.seedTitles}
        onChange={(value) => onChange({ ...profile, seedTitles: value })}
      />

      <fieldset className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-semibold">Location preferences</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Home city"
            value={profile.locations.homeBase.city}
            onChange={(city) =>
              onChange({
                ...profile,
                locations: {
                  ...profile.locations,
                  homeBase: { ...profile.locations.homeBase, city },
                },
              })
            }
          />
          <TextField
            label="Region"
            value={profile.locations.homeBase.region}
            onChange={(region) =>
              onChange({
                ...profile,
                locations: {
                  ...profile.locations,
                  homeBase: { ...profile.locations.homeBase, region },
                },
              })
            }
          />
          <TextField
            label="Postal code"
            value={profile.locations.homeBase.postalCode}
            onChange={(postalCode) =>
              onChange({
                ...profile,
                locations: {
                  ...profile.locations,
                  homeBase: { ...profile.locations.homeBase, postalCode },
                },
              })
            }
          />
        </div>
        <label className="mt-4 block text-sm font-medium">
          Additional locations (city, region, postal code per line)
          <textarea
            className={FIELD_CLASS}
            rows={Math.min(
              Math.max(profile.locations.additionalLocations.length, 2),
              5,
            )}
            value={profile.locations.additionalLocations
              .map(
                (location) =>
                  `${location.city}, ${location.region}, ${location.postalCode}`,
              )
              .join("\n")}
            onChange={(event) =>
              onChange({
                ...profile,
                locations: {
                  ...profile.locations,
                  additionalLocations: parseLocations(event.target.value),
                },
              })
            }
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {(["remote", "hybrid", "onsite"] as const).map((workMode) => (
            <label key={workMode} className="flex items-center gap-2 capitalize">
              <input
                type="checkbox"
                checked={profile.locations.workModes.includes(workMode)}
                onChange={(event) => {
                  const workModes = event.target.checked
                    ? [...profile.locations.workModes, workMode]
                    : profile.locations.workModes.filter(
                        (value) => value !== workMode,
                      );
                  onChange({
                    ...profile,
                    locations: { ...profile.locations, workModes },
                  });
                }}
              />
              {workMode}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={profile.locations.willingToRelocate ?? false}
              onChange={(event) =>
                onChange({
                  ...profile,
                  locations: {
                    ...profile.locations,
                    willingToRelocate: event.target.checked,
                  },
                })
              }
            />
            Open to relocation
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-semibold">Skills</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Primary skills (one per line)
            <textarea
              className={FIELD_CLASS}
              rows={5}
              value={profile.skills.primary.join("\n")}
              onChange={(event) =>
                updateList("skills", "primary", event.target.value)
              }
            />
          </label>
          <label className="block text-sm font-medium">
            Secondary skills (one per line)
            <textarea
              className={FIELD_CLASS}
              rows={5}
              value={profile.skills.secondary.join("\n")}
              onChange={(event) =>
                updateList("skills", "secondary", event.target.value)
              }
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-semibold">
          Compensation preferences
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Currency
            <input
              className={FIELD_CLASS}
              maxLength={3}
              placeholder="USD"
              value={profile.compensation.currency ?? ""}
              onChange={(event) =>
                onChange({
                  ...profile,
                  compensation: {
                    ...profile.compensation,
                    currency: optionalValue(event.target.value.toUpperCase()),
                  },
                })
              }
            />
          </label>
          <NumberField
            label="Minimum annual"
            value={profile.compensation.minimumAnnual}
            onChange={(minimumAnnual) =>
              onChange({
                ...profile,
                compensation: {
                  ...profile.compensation,
                  minimumAnnual,
                },
              })
            }
          />
          <NumberField
            label="Maximum annual"
            value={profile.compensation.maximumAnnual}
            onChange={(maximumAnnual) =>
              onChange({
                ...profile,
                compensation: {
                  ...profile.compensation,
                  maximumAnnual,
                },
              })
            }
          />
        </div>
        <label className="mt-4 block text-sm font-medium">
          Additional compensation rules
          <textarea
            className={FIELD_CLASS}
            rows={2}
            value={profile.compensation.notes ?? ""}
            onChange={(event) =>
              onChange({
                ...profile,
                compensation: {
                  ...profile.compensation,
                  notes: event.target.value,
                },
              })
            }
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-semibold">Search preferences</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={profile.searchPreferences.allowGeneratedTerms}
            onChange={(event) =>
              onChange({
                ...profile,
                searchPreferences: {
                  ...profile.searchPreferences,
                  allowGeneratedTerms: event.target.checked,
                },
              })
            }
          />
          Allow taxonomy- and AI-generated term suggestions
        </label>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Generated terms always require your approval before they can become
          active.
        </p>
      </fieldset>

      <label className="block text-sm font-medium">
        Professional direction
        <textarea
          className={FIELD_CLASS}
          rows={4}
          value={profile.professionalDirection}
          onChange={(event) =>
            onChange({
              ...profile,
              professionalDirection: event.target.value,
            })
          }
        />
      </label>
    </div>
  );
}

function TextListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label} (one per line)
      <textarea
        className={FIELD_CLASS}
        rows={Math.min(Math.max(value.length, 3), 6)}
        value={value.join("\n")}
        onChange={(event) => onChange(splitLines(event.target.value))}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className={FIELD_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className={FIELD_CLASS}
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? undefined : Number(event.target.value),
          )
        }
      />
    </label>
  );
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalValue(value: string): string | undefined {
  return value || undefined;
}

function parseLocations(value: string): CareerProfile["locations"]["homeBase"][] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [city = "", region = "", postalCode = ""] = line
        .split(",")
        .map((part) => part.trim());
      return { city, region, postalCode };
    });
}
