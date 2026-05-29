# Hazard Log

This is a first-pass hazard log for a local-only clinical shift scratchpad prototype. It is not a complete clinical safety case.

| Hazard | Description | Possible consequence | Mitigation in prototype | Remaining limitation |
|---|---|---|---|---|
| Wrong patient entered | User records a job against the wrong patient identifier or location. | Job done for wrong patient, delay for correct patient, confidentiality breach. | Identifier is optional and accompanied by minimum-necessary wording; location and task are visible on each card. | App cannot verify identity against hospital systems; user remains responsible for confirmation. |
| Task deleted accidentally | User deletes a job unintentionally. | Lost task, missed review or follow-up. | Delete action asks for confirmation and provides a brief undo bar. | Undo is time-limited, local only, and not an audit trail. |
| Task marked complete incorrectly | User marks done when task is not complete. | Task may be missed. | Marking done provides a brief undo bar; status remains visible and can be changed back. | No independent verification or confirmation workflow. |
| Task not marked complete | User completes task but leaves status pending/waiting. | Confusion, duplicate work, inefficient handover. | Large visible status controls on each card. | No reminders or integration with actual task completion. |
| Duplicate task created | Same job is added multiple times. | Wasted effort or contradictory task state. | Duplicate is explicit and visible; jobs list sorted visibly; fast edit/delete. | No duplicate detection, because that could slow entry and create false reassurance. |
| App crash | App closes or crashes during shift. | Temporary loss of access to scratchpad, possible missed task if data not persisted. | Jobs persist locally after restart. | No crash reporting, remote backup, or guaranteed recovery from device/app corruption. |
| Phone lost | Device containing scratchpad is lost or stolen. | Confidentiality breach if patient identifiers are present. | Local-only design avoids server-side spread; job data uses Expo SecureStore encrypted local storage on native platforms; wipe-all available when device is in hand. | Protection still depends on device lock/security, OS/keychain behaviour, and whether the device is unlocked or compromised. |
| Phone battery dies | User cannot access list. | Missed tasks or poor handover. | None beyond keeping app simple/offline. | Users still need formal handover habits and backup processes. |
| Stale task not cleared | Old job remains visible after no longer relevant. | User acts on stale information or gets clutter. | Default 24-hour expiry; manual clear completed and wipe-all. | Expiry only runs when app loads/interacts; existing jobs keep their original expiry. |
| Over-reliance on app instead of formal records/handover | User treats scratchpad as official system. | Missing documentation, unsafe handover, governance failure. | Settings and docs state it is not a medical record or formal handover. | Warnings cannot prevent misuse. |
| Workflow aid misread as clinical priority | User treats pin/star, job type, bump, or waiting-duration text as objective urgency/triage. | Inappropriate prioritisation or delayed escalation. | Wording keeps these as local workflow aids; formal urgency remains user-selected and no recommendations are generated. | UI cannot prevent cognitive over-reliance or misuse during busy shifts. |
| Clipboard leakage | Handover text copied to clipboard contains identifiers. | Patient-identifiable data exposed to other apps/services. | Copy action displays warning before copying. | Clipboard behaviour is OS/app dependent and not controlled by this app. |
| Excessive patient-identifiable information entered | User enters full name, DOB, NHS number, narrative identifiers, or unnecessary details. | Confidentiality breach if device/clipboard/screenshot exposed. | Identifier field note encourages minimum necessary identifiers. | App cannot reliably detect or prevent excessive free-text identifiers. |


## 2026-05 workflow-aid additions

- Hazard: Waiting-for/chase metadata could be mistaken for escalation or reminder logic.
  - Mitigation: UI/docs describe them as local plain-text organisation only; no alarms or recommendations.
  - Remaining limitation: User must still use formal clinical systems and judgement.
- Hazard: End-of-shift review/copy text could be mistaken for formal handover.
  - Mitigation: Wording says review/plain summary only, not a formal handover record.
  - Remaining limitation: Clipboard and copied identifiers can leak outside the app.
- Hazard: Undo stack could be mistaken for an audit trail.
  - Mitigation: Short-lived local undo only; docs explicitly say no audit trail.
  - Remaining limitation: App state changes are not medico-legal evidence.
- Hazard: Haptic feedback could be perceived as safety confirmation.
  - Mitigation: Haptics are optional/best-effort ergonomic feedback only.
  - Remaining limitation: Device/platform behaviour varies.
