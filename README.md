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

- Node.js 22.23+ within Node 22 LTS (the shared estate UI package requires Node <23)
- npm
- Expo-compatible phone, simulator or emulator (iOS/Android only)
- For Expo Go testing, an Expo Go build supporting **SDK 57**; a different SDK build will report that the project is incompatible.

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
```

The clinical app does not support a browser runtime: SecureStore is native-only. The separate public landing site remains available with `npm run dev:site` and `npm run build:site`.

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
- `src/theme.ts` — native light/dark colours matched to the pinned estate package, plus existing React Native layout styles; `tests/native-estate-theme.test.ts` checks token parity and text contrast
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

## Desk landing verification

The public landing uses the reviewed `ProjectPage.tsx` and `project-page.css`
template with project-specific copy in `project.ts`. Keep the template copies
identical to the [canonical project-page source](https://github.com/Snowslash/sangeev-me/tree/main/project-pages); the estate UI dependency
continues to own shared chrome and tokens, not this page body. The initial HTML
keeps the introduction, safety boundaries and real destinations available without
JavaScript. The application source and dependency pins are unchanged.

Using Node 22.23+ within Node 22, install from the lockfile with `npm ci`, then run:

```sh
npx vitest run --maxWorkers=1
node --test tests/public-site.contract.mjs
npm run typecheck
npm run build:site
node --test tests/public-site.contract.mjs
LANDING_BUILT=docs node --test tests/landing-copy.contract.mjs tests/landing-motion.contract.mjs
```

The landing tests use Node's type stripping, not the TypeScript compiler API. They
check literal reviewed copy, initial/emitted HTML and the actual screenshot hook's
completion, cancellation, fallback, reduced-motion and same-print reopen lifecycle.
They simulate DOM/time/scheduling; real focus, inertness and animation appearance
still require browser acceptance. Run these additional contracts alongside the
native checks above; they are not implicitly included in `npm test`.

Local preparation on 15 October 2026 passed 62 Vitest tests, 9 public-site contracts, typecheck, the site build and 9 landing copy/lifecycle checks.
This is local build verification, not a new deployment claim.
The full dependency audit retains 15 high affected-package records arising from
two advisories in the Expo/React Native tooling graph. The owner accepted this
residual for the web-page release, with no native dependency change or native app
distribution. [RELEASE-SECURITY.md](RELEASE-SECURITY.md) records the risks and follow-up
boundary; this is not a clean audit or a standing waiver for native releases.
