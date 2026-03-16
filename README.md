# Endurance Portal

Endurance is a student-facing portal for study-abroad document intake.
The site includes upload verification, missing-document alerts, and progress tracking.

- Deployment target: production-oriented Next.js app (server-rendered + API routes)
- Preferred stack: Firebase Auth + Firestore + Cloud Storage + Cloud Functions + Next.js App Router
- Current architecture mode: local development with server-capable production path

## What this project does

- Presents a dedicated onboarding home page for the document workflow
- Provides a `/portal` route for uploading documents
- Runs document checks in the browser (MVP baseline)
  - MIME type policy
  - File extension policy
  - File size boundaries
  - Binary signature checks for pdf/png/jpg
  - Duplicate checksum detection
  - Filename risk and document-intent heuristics
- Tracks application progress against required documents
- Generates alerts for missing required documents and rejected uploads

## Productionization status

- Step 1 is in progress/now locked: production architecture selected
  - Server-rendered Next.js app with API routes and server-side verification flow
  - Firebase-backed authentication, document metadata, and storage in the architecture target
- `next.config.ts` no longer uses static export mode (`output: "export"` removed)
- `.env.example` defines required runtime contracts for Firebase and verification settings

## State behavior (current)

- Current behavior remains in-memory for local MVP and preview workflows.
- Production persistence and async verification services are planned in Step 2 onward.

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Build

```bash
npm run build
npm run lint
```

## Firebase setup

Firebase config is externalized via environment variables in `.env.example` and will be introduced with production auth/storage services.
If Firebase is added, keep deployment path aligned with Next.js server rendering and function/API usage.

## Project structure

- `src/app/portal/page.tsx` — portal route
- `src/components/student-portal.tsx` — upload + verification UI
- `src/lib/student-application-schema.ts` — document types and state models
- `src/lib/student-application-service.ts` — verification and state logic (MVP baseline)
- `src/components/animated-home.tsx` — marketing/home hero
- `src/components/site-header.tsx` — global header
- `src/components/plus-burst-nav.tsx` — hero/nav utility
- `src/app/[slug]/page.tsx` — static slug page
- `src/app/layout.tsx` — app shell
- `src/app/globals.css` — global styling
- `implementation_plan.md` — step-by-step production execution plan

## Notes

- This implementation currently contains an MVP persistence layer in-memory for local simulation.
- All production document and user data must be moved to backend persistence and storage.

## Commit format

Commits follow the format:

`vX.Y.Z Your commit message`

`X = major`, `Y = minor`, `Z = patch`.
