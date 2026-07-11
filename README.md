# Clinical Shift Scratchpad

Local-first Expo React Native prototype for temporary ward-job organisation during a clinical shift.

It is a scratchpad: faster to capture and review than scattered paper, screenshots or memory. It is not a referral app, EHR, medical record, messaging system, clinical decision support tool, NHS-approved product, regulated medical device or production healthcare system.

Public project page: https://scratchpad.sangeev.me
Source: https://github.com/Snowslash/clinical-shift-scratchpad

## What it does

- free-text-first job capture
- optional minimum-necessary patient identifier
- optional location, urgency, job type and status fields
- quick add flow for several jobs in a row
- same-location fast add from the most recent job
- local note/location/status phrase shortcuts
- radial shortcut menus for common text insertion
- pinned jobs, bump-to-top, duplication and chase metadata
- compact card mode for dense lists
- non-clinical sort presets: pinned first, waiting longest, recently touched, by location, by status and by tag
- end-of-shift review text with an explicit clipboard warning
- local undo for recent destructive/status actions
- manual appearance setting: system, light or dark
- local auto-expiry, default 24 hours
- local wipe and clear-completed actions with brief undo

## Privacy and safety boundary

The app is designed as local temporary working memory, not a permanent record.

- No backend.
- No login.
- No cloud sync implemented by the app.
- No analytics or remote logging.
- No messaging, AI or EHR integration.
- Runtime storage uses `expo-secure-store` via `src/services/storage.ts`.
- Clipboard use can leak data to other apps/services; the review copy flow warns before copying.

Do not enter patient-identifiable information into public pages, screenshots or repositories. If you run the app with real clinical information, the data-governance risk is yours to assess locally.

## Requirements

- Node.js 20+
- npm
- Expo-compatible phone, simulator, emulator or browser target

## Set up

```bash
git clone https://github.com/Snowslash/clinical-shift-scratchpad.git
cd clinical-shift-scratchpad
npm install
```

## Run

Start Expo:

```bash
npm start
```

Run on common targets:

```bash
npm run android
npm run ios
npm run web
```

For phone testing over a tunnel:

```bash
npm start -- --tunnel --clear
```

## Verify

```bash
npm test
npm run typecheck
npm run build:site
```

## Main files

- `App.tsx` — app shell, state orchestration, persistence calls, navigation, undo, clipboard confirmation and render shell
- `src/components.tsx` — screens, modals, cards, radial shortcut menu, form controls and extracted UI components
- `src/theme.ts` — light/dark theme tokens and React Native styles
- `src/types/job.ts` — job, urgency, status, tag, pin, waiting-for, shift, appearance, haptics and settings types
- `src/services/storage.ts` — replaceable local storage abstraction
- `src/services/jobStore.ts` — local job persistence, expiry, settings, shift timer, chase metadata, wipe-all and restorable undo snapshots
- `src/utils/jobSorting.ts` — local sort presets, location grouping and filters
- `src/utils/textShortcuts.ts` — plain-text shortcut insertion helpers
- `src/utils/handover.ts` — end-of-shift review text generation
- `landing/` — Vite + React + TypeScript source for the public project page
- `docs/` — generated Cloudflare Pages output, clinical safety notes and deployment documents

## Known limitations

- Prototype, not production software.
- No formal clinical safety case.
- No regulatory or GDPR assurance.
- No audit trail; local status and chase metadata are workflow aids only.
- No authentication or device-level protection beyond the user’s device settings.
- SecureStore properties depend on platform and OS configuration.
- Screenshots, OS backups, phone loss, clipboard managers and shoulder-surfing remain risks.
- Existing jobs keep their originally calculated expiry if the auto-delete interval is changed later.
