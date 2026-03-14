# Talay Workshop — Claude Code Instructions

## Project Overview
Workshop management app for an international transport company tracking heavy-duty truck servicing.
- 150+ trucks, 2 app users (manager + assistant)
- Mechanics are NOT app users — they get printed Work Cards

## Repo
- `c:\GitHub\talay-workshop` → GitHub: `xb00tt/talay-workshop-v1`

## Tech Stack
- Next.js (App Router), Prisma, SQLite, NextAuth, Tailwind
- Frotcom API base URL: `https://v2api.frotcom.com/v2`
- Reports: react-pdf (PDF) + xlsx (Excel)
- Real-time: SWR polling (~30s intervals)
- Photos: local filesystem (→ S3 later)

## Domain Rules

### Service Order Flow
`SCHEDULED → INTAKE → IN_PROGRESS → QUALITY_CHECK → READY → COMPLETED`
Also: `CANCELLED` (reason required, manager only; kept in history)

### Stage Transition Warnings (warn, not block)
- Intake → InProgress: warn if intake equipment check not completed/skipped
- InProgress → QualityCheck: warn if any work cards still PENDING/ASSIGNED/IN_PROGRESS
- QualityCheck → Ready: warn if exit equipment check not completed/skipped or items still MISSING
- Ready → Completed: confirmation only

### Key Hard Blocks
- One active service per truck at a time

### Sections Auto-created at Intake
- CHECKLIST (items copied from active ChecklistTemplate)
- EQUIPMENT_CHECK

### Work Cards
- One per mechanic; cannot delete, can cancel or reopen
- Reopened → returns to IN_PROGRESS
- Notes: append-only (WorkCardNote)

### Equipment Check
- Warn + skippable at INTAKE and EXIT independently
- Skip must be noted; stored on ServiceSection (intakeSkippedAt/Note, exitSkippedAt/Note)

### Snapshots & History
- TruckEquipmentSnapshot saved on COMPLETED (from EXIT check; falls back to INTAKE if exit skipped)
- Historical mechanic names, driver names: kept as-is (snapshots, not FK lookups)

## Data Conventions
- Date format: DD.MM.YYYY
- Currency: Euro (€)
- mileageTriggerKm default: 30,000 km
- scheduledDate: date only (no time)
- Part.quantity: Float (decimals for liquids/oils)
- modelYear: nullable (~40% of fleet has none)
- Session: rolling 1-hour

## Auth & Users
- Login: username + password (no email field on User)
- Roles: MANAGER | ASSISTANT
- Permissions: JSON string[] on User (action-level, e.g. `service.create`, `truck.edit`)
- Password recovery: recovery code shown once at creation; manager can reset any user
- Multiple managers allowed; managers can manage each other's accounts

## Frotcom Integration
- Auth: POST /v2/authorize with provider="thirdparty"; token passed as ?api_key=TOKEN
- On 401: re-auth and retry once
- Mileage sync: GET /v2/vehicles (one call, all trucks); per-truck useCanbusMileage picks odometerCanbus vs odometerGps
- Import: step 1 GET /v2/vehicles (all), step 2 GET /v2/vehicles/{id} per NEW truck only (for modelYear)
- Skip duplicates by frotcomVehicleId
- Driver names: strip leading "*" prefix; skip if starts with digit or contains "created by"
- No maintenance sync — /v2/maintenance does not exist in Frotcom API

## Settings (singleton id=1)
- companyName, companyAddress, logoPath, frotcomUsername, frotcomPassword, frotcomToken
- Default Frotcom credentials seeded (not asked in setup wizard): `B5jX21vu0w3SV6S` / `0NnHoC6cF119xPSJLnbNcTBgSXq2`

## Printing
- A4, browser print + CSS print styles, must work on mobile
- Work card: one per mechanic; parts section has blank lines for mechanic to fill in
- Full service order print: separate from work card print
- Branding: company name, logo, address from Settings

## UI/UX
- Language: Bulgarian primary, English secondary (per-user preferredLocale; default "bg")
- Dark mode: per-user preference (default true)
- Pagination: 10 per page, user-editable
- Search: contextual full-text on every screen
- Mobile: fully responsive
- Mileage alerts: dashboard badge only (no email)
- Dashboard scheduled queue: capped at 10 upcoming
- Calendar: all statuses shown; can create service by clicking empty slot

## Audit Log
- Every field edit logged; kept forever; viewable as app screen
