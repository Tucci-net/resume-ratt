# Resume Ratt

Resume Ratt provides an editable career profile and a resume editor with a
live preview and browser-based printing.
## Project status

**Current milestone: 0E Echo'**
## Roadmap

### Phase 0 — Foundation
- [x] **0A Alpha** — Resume editor proof of concept
- [x] **0B Bravo** — Career Library and canonical records
- [x] **0C Charlie** — Import workflow, reconciliation, architecture cleanup
- [x] **0D Delta** — Lifecycle hardening, submitted snapshots, E2E validation
- [x] **0E Echo** — Full Resume Lifecycle implementation, Clean PDF Rendering

### Phase 1 — Evidence & Portability
- [ ] **1A Alpha** — Evidence records, provenance, verification states
- [ ] **1B Bravo** — Approved wording variants and artifact references
- [ ] **1C Charlie** — Resume and career-data exports
- [ ] **1D Delta** — Round-trip and evidence/export hardening

### Phase 2 — Job Ingestion
- [ ] **2A Alpha** — Pasted job descriptions
- [ ] **2B Bravo** — Structured requirement extraction
- [ ] **2C Charlie** — URL ingestion and source provenance
- [ ] **2D Delta** — Freshness, normalization, and ingestion hardening

### Phase 3 — Matching
- [ ] **3A Alpha** — Requirement-to-evidence matching
- [ ] **3B Bravo** — Direct, transferable, partial, and gap classification
- [ ] **3C Charlie** — Explainable career/job fit scoring
- [ ] **3D Delta** — Matching validation and human override

### Phase 4 — Search / Auto-Scrub
- [ ] **4A Alpha** — Provider adapter interface
- [ ] **4B Bravo** — Initial approved job sources
- [ ] **4C Charlie** — Query planner, deduplication, and search orchestration
- [ ] **4D Delta** — Freshness verification and search hardening

### Phase 5 — Application Workflow
- [ ] **5A Alpha** — Job-specific resume generation
- [ ] **5B Bravo** — Application packages and supporting materials
- [ ] **5C Charlie** — Application tracking and follow-up state
- [ ] **5D Delta** — Submission history and workflow hardening

### Later
- Multi-user persistence and authentication
- Self-hosting / enterprise deployment
- Analytics based on application outcomes
- 
## Current behavior

- Resume drafts, Career Library data, and submitted snapshots are stored in
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
- Working Drafts save in Resume Ratt's local draft store with a persisted
  revision number. Save is separate from downloading an export.
- **Export Resume** downloads only the selected draft presentation in Markdown,
  plain text, JSON, or PDF. The Markdown is human-readable, preserves visible
  section ordering and links, and intentionally omits Career Library IDs,
  evidence references, and revision metadata.
- Markdown Resume exports can be loaded by **Import Resume**, reviewed, and
  approved back into the Career Library and Working Draft. Conventional section
  headings, contact details, and structured entry fields are reconstructed.
- **Export Career Data** is separate from Resume export and downloads the
  canonical Career Library as a Markdown vault or JSON. A backup archive is
  not yet available.
- PDF files are generated directly from resume presentation data with
  selectable text, Letter page dimensions, fixed margins, no app chrome, and
  fixed PDF metadata dates. PDF export does not use browser printing.
- **Print · Clean Print View** remains separate and uses the print stylesheet
  to show only resume content. Browser-generated print headers and footers may
  still depend on the user's print settings.
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
- The dashboard is open for guest use. GitHub sign-in is available when its
  environment variables are configured.

## Stack

- Next.js App Router with React and TypeScript
- Tailwind CSS
- Auth.js with Prisma/PostgreSQL scaffolding
- Zod profile validation and YAML front matter parsing
- `@react-pdf/renderer` for direct, selectable-text resume PDF exports
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

Resume Ratt separates career identity, search preferences, taxonomy knowledge,
and operational search state.

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
copy of the John Smith profile, and check dashboard save/reload alongside the
resume editor workflow.
