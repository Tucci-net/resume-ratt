# Resume Ratt

Resume Ratt is a small resume editor with a live preview and browser-based
printing. Add your contact details, summary, work history, and skills, then use
**Print / Save as PDF** to keep or share your resume.

## Current behavior

- Resume edits are held in memory in the current browser session.
- The app does not currently save resume data to a database or browser storage.
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

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The Playwright smoke test starts the development server and checks that the
homepage and resume editor are served.
