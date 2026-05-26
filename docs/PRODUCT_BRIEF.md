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
- local-only persistence
- local auto-expiry
- local wipe-all
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
- `createdAt`
- `updatedAt`
- `expiresAt`

## MVP screens

1. Jobs list: active jobs sorted by urgency/status/age, quick status filters, one-tap status changes, fast edit/delete.
2. Fast add: free text first, minimal mandatory input, one-handed friendly, no wizard.
3. Settings/privacy: auto-delete interval, wipe-all, not-a-medical-record notice, local-only temporary storage notice, limitations.
4. Dormant handover utility: plain text review grouped by urgency/status may be re-exposed later only if field use shows a clear need.

## Product feel

Fast, boring, functional, reliable, low-friction.

Avoid corporate health-tech aesthetics, fake dashboards, onboarding, login screens, clever slow gestures, and anything that feels like an enterprise NHS system.
