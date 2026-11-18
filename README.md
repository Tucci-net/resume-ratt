# Resume Ratt

Resume Ratt provides an editable career profile and a resume editor with a
live preview and browser-based printing.

## Current behavior

- Résumé drafts, Career Library data, and submitted snapshots are stored in
  browser-local storage. Their authority boundaries are intentional:
  - **Career Library — Canonical Career Evidence:** factual claims and evidence
    IDs, with versioned canonical revisions and proposed wording variants.
  - **Working Draft — Application Presentation:** a mutable, materialized
    presentation snapshot with selected evidence IDs, wording, layout, and
    source revisions. Its duplicated content is intentional for versioning,
    application reproducibility, and auditability; draft edits never silently
    change canonical evidence.
  - **Submitted Snapshot — Immutable History:** submission content and the
    exact Career Library IDs, evidence IDs, variants, canonical revisions, and
    evidence text used at submission. Later draft or Career Library edits do
    not rewrite a snapshot.
- Canonical revisions changing flag linked working drafts as stale without
  rewriting their presentation. Draft wording can be kept draft-only or
  explicitly proposed as a Career Library wording variant.
- Career Library JSON/Markdown imports reconcile by ID and revision, rejecting
  stale edits rather than overwriting newer changes.
- **Import Resume** accepts pasted plain text, Markdown, and JSON. Recognized
  sections are shown in a review step where items can be edited, selected, or
  rejected before approval saves them to the Career Library.
- Restricted JSON résumé evidence is unchecked by default in that review step
  and is saved only when explicitly selected.
- The Career Profile dashboard loads a validated Markdown/YAML profile by its
  stable profile ID. Local development automatically selects the Tanner seed
  profile from `profiles/profile-tanner.md`.
- Playwright uses a generated temporary directory and the synthetic fixture in
  `e2e/fixtures`; it never writes to the development seed profile.
- Profile changes are staged, validated, and require explicit approval before
  the Markdown source is updated. This file-backed write path is development
  only; production edits require a durable repository implementation.
- Search Strategy expands CareerProfile inputs with a versioned taxonomy.
  Generated terms remain proposed until explicitly approved; approved and seed
  terms appear in a deterministic, provider-neutral query plan.
- Provider recommendations use only the configured catalog metadata.
  Search adapters, external requests, scraping, job ingestion, and scoring are
  not implemented.
- Typography settings include a curated Google Fonts list and browser-local
  TrueType font uploads. Only the selected Google Font is requested; uploaded
  font files are not sent to the server.
- Use your browser's print dialog to print or save a PDF.
- The dashboard is open for guest use. GitHub sign-in is available when its
  environment variables are configured.

## Stack

- Next.js App Router with React and TypeScript
- Tailwind CSS
- Auth.js with Prisma/PostgreSQL scaffolding
- Zod profile validation and YAML front matter parsing
- Vitest

## Getting started

Requirements: Node.js 20 or newer and pnpm 11 or newer.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Prisma Client is generated during install. To generate it manually:

```bash
pnpm exec prisma generate
```

GitHub authentication and database-backed features require values from
`.env.example`. The resume editor itself can be used without signing in or
configuring a database.

## Career profiles

Set `CAREER_PROFILE_ID` to select a profile in the `profiles` directory.
Without that setting, only local development defaults to `profile-tanner`;
production shows a no-profile state instead of applying Tanner's profile to
all users. `CAREER_PROFILE_DIRECTORY` can point the local Markdown repository
at a different directory for isolated testing.

All profile loads, updates, validation, and exports take a `profileId`.
Profile updates use a content revision to reject stale writes. The dashboard
does not parse YAML, and generated role families or search terms are not
hardcoded in the UI. Profile files should be backed up and reviewed like other
source data. Vercel's serverless filesystem is not a durable profile store, so
the current Markdown update endpoint intentionally refuses production writes.

## Search Intelligence

The Search Strategy page is linked from the dashboard. Its data pipeline is:

```text
CareerProfile + SearchPreferences + RoleTaxonomy
                    ↓
               SearchProfile
                    ↓
                QueryPlanner
                    ↓
              ProviderRegistry
                    ↓
          future source adapters
```

These inputs have distinct responsibilities:

- **Identity:** `profiles/{profileId}.md` stores career background, target
  identity, seed titles, location, and skills. Search generation does not
  rewrite this source.
- **Evidence:** user-authored seed titles, skills, and responsibilities are
  marked as user-originated terms. Taxonomy matches and suggestions carry
  source references, triggering inputs, rationale, confidence, and optional
  drift warnings.
- **Search preferences:** `profiles/{profileId}/search-preferences.md` stores
  decisions and search-specific rules independently from career identity.
  It contains approved, rejected, and deferred terms; role-family decisions;
  custom and negative terms; location, compensation, work authorization,
  seniority, work-arrangement, source, and query-planning preferences. The
  versioned YAML front matter is Markdown and can be reviewed or backed up with
  the rest of the profile vault. Its top-level fields are `schemaVersion`,
  `profileId`, `version`, `terms`, `roleFamilyDecisions`,
  `desiredResponsibilities`, `negativeKeywords`, `preferredIndustries`,
  `excludedIndustries`, `seniorityPreferences`, `locationRules`,
  `compensationRules`, `workArrangement`, `workAuthorization`,
  `sourcePreferences`, and `queryPlanning`.
- **Search terms:** each term records an ID, value, type, status, source,
  source reference, triggering inputs, rationale, confidence, related role
  families, creation/update timestamps, and an optional drift warning. Status
  is `seed`, `proposed`, `approved`, `rejected`, or `deferred`; source is
  `user`, `taxonomy`, `rule`, or `ai`. Generated terms require explicit
  approval before they can enter a plan.
- **Taxonomy knowledge:** the small, versioned English starter taxonomy is data
  under `data/taxonomy/en-US/`. Separate YAML documents describe role families,
  titles, skills, responsibilities, aliases, and industries. Role families
  express related families with a relationship and strength; titles link to
  families, responsibilities, and skills; skills and industries also declare
  their relationships. References are validated when the taxonomy is loaded;
  additional locales can be added in separate directories.
- **Operational search data:** a rebuilt `SearchProfile` is derived from the
  career profile, preferences, and taxonomy. `SearchPlan` contains focused
  queries made only from seed and approved terms. Rejected, deferred, and
  proposed terms are never active. The provider catalog lives in
  `data/providers/catalog.yaml`; each provider declares its type, countries,
  role families, industries, capabilities, auth requirements, automation
  policy, enabled state, and catalog status. Capabilities are advertised only
  when explicitly configured.

When no search-preferences sidecar exists, legacy search preferences, terms,
and source selections embedded in older CareerProfile files are imported in
memory for compatibility. The CareerProfile file is not changed. The first
explicit save creates the separate sidecar. Markdown writes remain development
only until a durable production repository is configured.

The initial catalog contains a conservative manual source entry. Provider
recommendations explain their rationale and can report available, recommended,
disabled, unsupported, or requires-configuration states. They do not contact
providers. The planned query preview is not evidence that a search has run and
does not display job counts.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The Playwright tests start the development server, use an isolated temporary
copy of the Tanner profile, and check dashboard save/reload alongside the
resume editor workflow.
