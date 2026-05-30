# Clinical Shift Scratchpad

A tiny local-only Expo React Native prototype for transient clinical shift jobs.

This is not a referral app, EHR, medical record, messaging system, decision support tool, AI product, NHS-approved clinical safety system, or production-ready healthcare platform.

It is intended as a structured scratchpad: faster and clearer than Apple Notes, scraps of paper, folded ward lists, WhatsApp-to-self, screenshots, and memory.

## Current prototype

Works as a local mobile prototype with:

- fast free-text-first job creation
- editable text-entry shortcuts via gesture-handler radial menus on long-press for job note/location fields, including `M`/`F` note prefixes and common investigation abbreviations
- editable local location shortcuts, defaulting to `TCI`
- editable local job-note shortcut library in Settings; the first 8 are radial favourites to keep the one-handed wheel tappable
- optional minimum-necessary patient identifier
- optional ward/area/bed location, with a same-location fast-add action from the most recent job
- optional plain job type tags: review / bloods / imaging / call / family / discharge / prescribing / handover
- urgency: routine / soon / urgent
- status: pending / seen / waiting / done
- pin/star jobs for personal attention without implying clinical priority
- last-touched or waiting-duration text on each card
- bump-to-top and duplicate-job actions for repeated ward tasks
- optional compact card mode for dense active lists
- manual appearance setting: system / light / dark mode
- end-of-shift review screen for active versus completed jobs, with an explicitly warned local clipboard copy action for a plain-text summary
- quick-capture Add + keep open flow for receiving several jobs in a row
- non-clinical sort presets: pinned first / waiting longest / recently touched / by location / by status / by tag
- optional location grouping
- optional Waiting for field plus editable status phrase shortcuts
- one-tap Chase action that updates local chase metadata and last-touched time
- small undo stack for recent destructive/status actions; this is not an audit trail
- optional haptic feedback for key interactions
- local persistence after app restart
- local auto-expiry, default 24 hours
- clear completed jobs with brief undo
- manual wipe-all with brief undo
- handover-style text summary is available from the end-of-shift review screen with a clipboard warning before copying
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

Start Expo with tunnel and cache clear, which is usually the best phone-testing command from PowerShell:

```bash
npm run start -- --tunnel --clear
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

- `App.tsx` — app shell, state orchestration, persistence calls, navigation, undo, clipboard confirmation, and render shell
- `src/components.tsx` — screens, modals, cards, radial shortcut menu, form controls, and other extracted UI components
- `src/theme.ts` — light/dark theme tokens and shared React Native styles
- `src/types/job.ts` — job, urgency, status, tag, pin, waiting-for, shift, appearance, haptics, and settings types
- `src/services/storage.ts` — replaceable storage abstraction
- `src/services/jobStore.ts` — local job persistence, expiry, settings, shift timer, chase metadata, wipe-all, and restorable undo snapshots
- `src/utils/jobSorting.ts` — non-clinical sort presets, location grouping, and filters
- `src/utils/textShortcuts.ts` — plain-text shortcut insertion helpers
- `src/utils/handover.ts` — end-of-shift review/handover text generation used by the warned clipboard copy flow
- `metro.config.js` — Expo Metro config with Windows-safe empty-module path normalisation
- `docs/` — product, data handling, clinical safety, and hazard notes

## Known limitations

- Uses encrypted local storage on native platforms via Expo SecureStore. This improves the first-pass privacy posture but is not a clinical, NHS, or GDPR assurance.
- SecureStore availability and security properties depend on the device platform and OS configuration.
- No formal clinical safety case.
- No regulatory/GDPR assurance.
- No audit trail; pinning, bumping, chase, waiting-for text, shift timer, haptics, sort/group controls, and job types are local workflow aids only.
- No authentication or device-level access control beyond the user's device settings.
- Clipboard use may leak patient-identifiable data to other apps/services when using the end-of-shift review copy feature.
- Phone loss, screenshots, OS backups, and shoulder-surfing remain risks.
- Existing jobs keep their originally calculated expiry if the auto-delete interval is changed later.
- This is a scaffold/prototype, not production-ready software.
