# Field Test Notes

## 2026-05-26 — On-call shift

- Shift type: on-call
- Approximate referrals/jobs entered: 7
- Overall result: good and fast during real shift use

### What felt faster than paper / Notes

- Finding relevant information again during the shift.
- Entering information into a structured scratchpad rather than hunting through paper or generic notes.

### What felt slower

- One-handed typing.
- Repeated entry of similar job content.
- Repeated typing of common blood-test abbreviations/results such as Hb, WCC, CRP.
- Keyboard and field positioning sometimes meant the text being typed was not clearly visible.

### Safety or data concerns noticed

- None reported during this shift.

### Top change before next shift

- Move the Save button to the top left of the fast-add/edit sheet.
- Adjust the fast-add fields/keyboard behaviour so the active text remains clearly visible while typing.

### Current feature judgement

- Handover view is not needed at this moment.
- Do not expand the product around handover until repeated use shows a clear need.

### Possible future shortcut work

Observed repeated job patterns suggest shortcuts may be useful, but should stay narrow and fast:

- quick blood-result chips/snippets: Hb, WCC, CRP, Na, K, Cr, eGFR, INR, lactate
- repeat/copy previous location
- small configurable phrase snippets for common on-call jobs

Do not add these until the fast-add visibility/save-position change has been tested on another shift.

## 2026-05-27 — Repeat clinical use

- Shift/use context: clinical scratchpad used again during real clinical work.
- Overall result: useful again.
- Specific positive signal: radial shortcut menu was useful in practice.
- Safety or data concerns noticed: none reported in chat.

### Product judgement

- The radial-menu direction is now validated enough to keep refining, rather than reverting to visible shortcut buttons.
- Do not add interpretation, triage, or structured demographics. Keep shortcuts as plain text insertion only.

### Change made after this use

- Job-note shortcuts are now editable in Settings, matching the existing local location-shortcut pattern.
- Default note shortcuts expanded to cover common quick-entry items: `M`, `F`, `Hb`, `WCC`, `CRP`, `Na`, `K`, `Cr`, `eGFR`, `INR`, `lactate`, `abdo pain`.
- The radial menu deliberately shows only the first 8 note shortcuts as favourites. Extra snippets can stay lower in the settings list as candidates/library items, but the wheel should remain one-handed and tappable.

### Follow-up changes implemented

- Added compact card mode to reduce vertical friction during longer active lists.
- Added pin/star as a personal attention marker. This is deliberately separate from urgency and does not mean clinical priority.
- Added last-touched / waiting-duration text on cards, plus a bump action to refresh a job after review.
- Added same-location fast add and duplicate-job actions for repeated ward/location work.
- Added optional plain job type tags: review, bloods, imaging, call, family, discharge, prescribing, handover.
- Safety boundary retained: these are local workflow labels/actions only, with no triage, scoring, reminders, recommendations, or EHR/referral behaviour.

## 2026-05-27 — Appearance refinement

- Added a persisted appearance setting: system / light / dark.
- Rationale: on-call use benefits from a reliable dark mode even when the device/system appearance is not set the way the user wants.
- This is a pure UI preference and does not change data handling or clinical workflow behaviour.


## 2026-05 further workflow iteration

After repeated real-shift usefulness, implemented the next batch except private-screen/low-identifier mode and scratch-line temporary input: shift timer, end-of-shift review, quick capture, sort presets, location grouping, status phrase shortcuts, Waiting for field, chase bump, larger undo stack, and haptics. Next field test should check whether these reduce friction or add clutter, especially quick capture, waiting/chase wording, location grouping density, and haptic usefulness.
