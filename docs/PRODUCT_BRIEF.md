# Product Brief

## Thesis

A structured clinical scratchpad with less friction than Apple Notes, built specifically for transient clinical jobs during a shift.

Clinicians already create unofficial temporary lists during shifts because formal systems are too slow. This app gives that behaviour just enough structure to reduce loss and ambiguity without becoming a formal medical record or another hospital system.

## Design commandment

If Apple Notes is faster, we have failed.

Every feature must answer: does this make the app faster, safer, or clearer than Notes or paper during a busy clinical shift?

## In scope

- temporary shift organiser
- structured scratchpad
- local jobs list
- rapid add/edit/status tracking
- compact card mode for dense job lists
- manual appearance setting: system / light / dark mode
- pin/star as a personal attention marker, explicitly not clinical prioritisation
- last-touched/waiting-duration display, bump-to-top, same-location add, duplicate job, and optional plain job type tags
- local-only persistence
- local auto-expiry
- local wipe-all
- editable plain-text shortcuts for repeated note/location entry; the first 8 note shortcuts are radial favourites and extras remain lower-priority library/candidates; shortcuts must remain text insertion only, not clinical logic
- text-style handover review retained as dormant code, but not exposed after first field test because it was not needed during on-call use

## Out of scope

- referral management platform
- EHR or medical record
- account system
- backend
- cloud sync
- messaging
- analytics
- AI
- clinical recommendations
- triage/risk scoring
- NHS approval claims
- production-readiness claims

## MVP fields

- `id`
- `patientIdentifier` optional, free text, minimum necessary
- `location`
- `taskText`
- `urgency`: routine / soon / urgent
- `status`: pending / seen / waiting / done
- `jobType` optional local label: review / bloods / imaging / call / family / discharge / prescribing / handover
- `pinned` optional personal attention marker
- `createdAt`
- `updatedAt`
- `expiresAt`

## MVP screens

1. Jobs list: active jobs sorted by pinned/urgency/status/last-touched, quick status filters, one-tap status changes, pin/bump/duplicate, fast edit/delete, optional compact density.
2. Fast add: free text first, minimal mandatory input, one-handed friendly, no wizard.
3. Settings/privacy: appearance mode, auto-delete interval, compact-card toggle, editable note/location shortcuts, wipe-all, not-a-medical-record notice, local-only temporary storage notice, limitations.
4. Dormant handover utility: plain text review grouped by urgency/status may be re-exposed later only if field use shows a clear need.

## Product feel

Fast, boring, functional, reliable, low-friction.

Avoid corporate health-tech aesthetics, fake dashboards, onboarding, login screens, clever slow gestures, and anything that feels like an enterprise NHS system.


### 2026-05 post-field-use workflow expansion

Added after repeated on-call use: local shift timer, end-of-shift review, quick-capture add-and-keep-open flow, non-clinical sort presets, optional location grouping, Waiting for field, editable waiting/status phrase shortcuts, one-tap Chase metadata, a small local undo stack, and optional haptic feedback. These remain speed/organisation aids only. They do not create reminders, escalation logic, clinical recommendations, triage, referral workflow, EHR integration, audit trail, or formal handover status.
