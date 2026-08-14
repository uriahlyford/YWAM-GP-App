# Sala — school management for Cambodian primary schools

Bilingual (English / ភាសាខ្មែរ) management of students, guardians, classes,
attendance and grades, built so a teacher can open the app, tap through a class
register and be finished in under a minute — on a phone, in a classroom.

This is a separate application from the Vision 2033 tracker at the root of this
repository. It has its own dependencies, its own database and its own Netlify
site; nothing is shared between them.

## Stack

- **Next.js 16** (App Router, Turbopack, server actions) + TypeScript
- **PostgreSQL** via **Prisma 7** with the `pg` driver adapter
- **Tailwind CSS v4**
- Sessions in the database, argon2id passwords — no third-party auth service
- Self-hosted Noto Sans Khmer and Inter (no runtime request to Google)

## Local development

Requires Node 20.9+ and a PostgreSQL 16 server.

```bash
createdb school_dev
cp .env.example .env          # then edit DATABASE_URL
npm install
npm run db:migrate            # applies migrations, creates pg_trgm
npm run db:seed               # realistic bilingual demo data
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/en` or `/km` depending on
your browser's `Accept-Language`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` then a production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Drop, re-migrate and re-seed |

## Three decisions worth knowing before you change anything

**Calendar dates are strings, not `Date`s.** Cambodia is UTC+7, so a date
derived from a UTC timestamp is wrong for the first seven hours of every local
day — a register taken at 06:45 would file against yesterday. Everything in the
app passes `YYYY-MM-DD` strings (`DateOnly` in `src/lib/date.ts`) and converts to
a `Date` only at the Prisma boundary. Don't call `new Date()` and slice it.

**Every mutation goes through the audit wrapper.** Mutations are server actions
wrapped in `authorize → validate → mutate → audit`. Writing a mutation that
bypasses it means an untraceable change to a child's record.

**Search uses trigrams, not full-text search.** Khmer is written without spaces
between words, so `to_tsvector` indexes a Khmer name as one unsearchable token.
The `pg_trgm` GIN indexes in the initial migration are what make Khmer search
work; keep them if you touch the name columns.

## Deployment

Netlify, with **base directory `apps/school`** — the repository root belongs to
the other application. The database is Neon; `DATABASE_URL` must be the
**pooled** (`-pooler`) connection string.

## Language

Khmer strings live in `src/lib/i18n/messages/km.ts`, typed against the English
catalogue so a missing translation fails the build rather than surfacing as an
English word on a Khmer screen. Numerals stay Arabic in both languages, which is
standard in Cambodian school and government documents.

**Recommend a Khmer-speaking teacher reads `km.ts` end to end before this goes in
front of parents.**

## What is built

Phase 1, slices 1–7:

| Area | State |
| --- | --- |
| Authentication, sessions, roles | Complete |
| Activity log (audit trail) | Complete |
| School, academic years, terms, grade levels, subjects | Complete |
| Students, parents/guardians, teachers | Complete |
| Classes, teacher assignment, enrollment, promotion | Complete |
| **Attendance** | Complete |
| Dashboard | Minimal — what's outstanding today and who is absent |

Not yet built, in the order originally planned: the gradebook UI (the schema,
assessments and per-subject averages already exist and appear on a student's
profile), the report screens with CSV/Excel/PDF export, global search across the
whole school, and the PWA service worker. Phase 2's arrival/departure tracking
and parent notifications have their tables in place and unused.

## Testing

```bash
npm run test:e2e          # reseeds, then runs Playwright on phone + desktop
npm run test:e2e:only     # without reseeding
```

72 checks. They deliberately cover the things unit tests cannot: that a teacher
cannot reach another class's children by URL, that a register is dated in the
school's timezone and not the browser's, that a Khmer name is findable by
search, and that changing one child's attendance writes exactly one audit entry.

`CHROMIUM_PATH` can point at an existing Chromium instead of a downloaded one.
