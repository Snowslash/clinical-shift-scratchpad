# Clinical Shift Scratchpad

A tiny local-only Expo React Native prototype for transient clinical shift jobs.

This is not a referral app, EHR, medical record, messaging system, decision support tool, AI product, NHS-approved clinical safety system, or production-ready healthcare platform.

It is intended as a structured scratchpad: faster and clearer than Apple Notes, scraps of paper, folded ward lists, WhatsApp-to-self, screenshots, and memory.

## Current prototype

Works as a local mobile prototype with:

- fast free-text-first job creation
- text-entry shortcuts via gesture-handler radial menus on long-press for job note/location fields, including `M`/`F` note prefixes
- editable local location shortcuts, defaulting to `TCI`
- optional minimum-necessary patient identifier
- optional ward/area/bed location
- urgency: routine / soon / urgent
- status: pending / seen / waiting / done
- local persistence after app restart
- local auto-expiry, default 24 hours
- clear completed jobs with brief undo
- manual wipe-all with brief undo
- handover-style text summary code retained but hidden from primary navigation after first field test
- no login, backend, cloud sync, analytics, messaging, AI, or EHR integration

## Data handling summary

The app uses local-only, temporary, auto-expiring storage.

Storage currently uses `expo-secure-store` through `src/services/storage.ts`. On native mobile platforms this stores values in iOS Keychain / Android encrypted SharedPreferences. Larger job-list payloads are split into small encrypted chunks behind a manifest because SecureStore has practical per-value size limits.

No patient-identifiable data should leave the device. There is no cloud backup implemented by the app, no analytics, no remote logging, and no network calls required by the runtime app.

## Setup

Requirements:

- Node.js 20+
- npm
- Expo-compatible development device or emulator

Install dependencies from wherever you cloned the repository:

```bash
git clone https://github.com/Snowslash/clinical-shift-scratchpad.git
cd clinical-shift-scratchpad
npm install
```

If you already have the repository locally, just `cd` into your local `clinical-shift-scratchpad` folder before running the commands below.

Run automated tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

Start Expo:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

Run on iOS:

```bash
npm run ios
```

Run on web for a quick development smoke test:

```bash
npm run web
```

## Main files

- `App.tsx` — single-screen-app prototype UI and interactions
- `src/types/job.ts` — job, urgency, status, and settings types
- `src/services/storage.ts` — replaceable storage abstraction
- `src/services/jobStore.ts` — local job persistence, expiry, settings, wipe-all, and restorable undo snapshots
- `src/utils/jobSorting.ts` — urgency/status/age sorting and filters
- `src/utils/textShortcuts.ts` — plain-text shortcut insertion helpers
- `src/utils/handover.ts` — handover text generation retained but not currently exposed in main navigation
- `docs/` — product, data handling, clinical safety, and hazard notes

## Known limitations

- Uses encrypted local storage on native platforms via Expo SecureStore. This improves the first-pass privacy posture but is not a clinical, NHS, or GDPR assurance.
- SecureStore availability and security properties depend on the device platform and OS configuration.
- No formal clinical safety case.
- No regulatory/GDPR assurance.
- No audit trail.
- No authentication or device-level access control beyond the user's device settings.
- Clipboard use may leak patient-identifiable data to other apps/services if the hidden handover/copy feature is re-exposed.
- Phone loss, screenshots, OS backups, and shoulder-surfing remain risks.
- Existing jobs keep their originally calculated expiry if the auto-delete interval is changed later.
- This is a scaffold/prototype, not production-ready software.
