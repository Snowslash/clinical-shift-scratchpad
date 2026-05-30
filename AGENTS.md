# Expo project notes

## Agent Behaviour
- State assumptions when they materially affect implementation. Ask before choosing between genuinely different interpretations.
- Prefer the smallest change that satisfies the request; do not add speculative features, abstractions, configurability, or broad error handling unless asked.
- Make surgical edits: touch only files/lines required by the task. Do not drive-by refactor, reformat, rename, or clean up unrelated code.
- Preserve existing style and project shape even if you would design it differently.
- If you notice unrelated issues, mention them separately rather than fixing them silently.
- Define success criteria before substantial changes, then verify with the project's tests/build/lint/smoke checks before reporting completion.
- Remove only dead code/imports introduced by your own changes unless explicitly asked to clean wider code.

This prototype currently uses Expo SDK 54. Check the versioned Expo SDK 54 documentation before changing Expo-specific code:

https://docs.expo.dev/versions/v54.0.0/
