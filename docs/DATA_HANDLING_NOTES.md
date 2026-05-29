# Data Handling Notes

## Current storage model

The app uses local-only, temporary, auto-expiring storage.

Jobs persist locally after app restart and are purged locally after their `expiresAt` timestamp. The default expiry is 24 hours.

## Current implementation

- Storage driver: `src/services/storage.ts`
- Job store: `src/services/jobStore.ts`
- Current driver: `expo-secure-store`

On native mobile platforms, Expo SecureStore stores values in iOS Keychain / Android encrypted SharedPreferences. The app wraps SecureStore in `src/services/storage.ts`. App-level storage keys such as `clinical-shift-scratchpad/jobs/v1` are mapped to stable alphanumeric SecureStore keys because some SecureStore versions reject `/`, `:`, and other punctuation in keys.

Because SecureStore has practical per-value size limits, `src/services/storage.ts` chunks larger values into small encrypted SecureStore entries and stores a SecureStore manifest at the original key. This keeps the job store API simple while avoiding immediate failure as the scratchpad grows.

This is encrypted local storage for the prototype, not a compliance claim. It does not make the app NHS-approved, GDPR-assured, clinically safety-assured, or production-ready.

## What the app does not do

- no backend
- no cloud sync
- no account system
- no analytics
- no remote logging
- no EHR integration
- no messaging
- no push notifications
- no network calls required by the runtime app

## Patient-identifiable information

No patient-identifiable data should leave the device through this app.

Users are prompted to use the minimum necessary identifier. The app cannot enforce good information governance by itself.

## Clipboard

The handover view can copy text to the local clipboard. This is useful but risky. Clipboards may be visible to other apps, OS services, keyboards, remote desktop tools, or device sync features. The app warns before copying.

## Device-level risks

Local-only does not mean risk-free. Remaining risks include:

- phone loss/theft, especially if device lock/security is weak
- unlocked device access
- screenshots
- OS-level backups or device-transfer processes outside app control
- shared clipboard services
- shoulder-surfing
- malware or compromised device
- platform-specific SecureStore behaviour or keychain/keystore accessibility settings

## Honest limitation

Do not describe this as storing nothing. It stores data locally until deletion or expiry. Correct wording: local-only, temporary, auto-expiring storage.


### Workflow metadata

The app now stores additional local metadata such as shift start time, Waiting for text, last chased time/count, status phrase shortcuts, haptics preference, and sort/group UI state. This data remains local-only in the same app storage boundary. It is not synced, not sent to a server, and not a formal clinical record or audit trail.
