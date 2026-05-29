# Clinical Safety Notes

## Status

This is a prototype structured scratchpad for transient shift jobs. It is not clinically safety-assured and is not production-ready.

Do not claim it is clinically safe, NHS-approved, GDPR-compliant, a medical device, an EHR, a formal referral system, or a formal handover record.

## Intended use

A low-friction local organiser for unofficial temporary shift jobs, similar in role to notes on paper or a personal notes app, but with more structure.

## Non-intended use

- definitive clinical record
- formal handover record
- referral management
- escalation pathway
- diagnostic or treatment decision support
- replacement for hospital systems
- replacement for verbal escalation where required

## Safety principles in the scaffold

- no clinical recommendations
- no prioritisation beyond user-selected urgency labels
- pin/star, job type, bump, duplicate, and waiting-duration display are local workflow aids only, not clinical triage or escalation logic
- no AI summaries or triage
- no hidden automation
- auto-expiry to reduce stale data
- wipe-all for end-of-shift cleanup
- minimum-necessary identifier prompt
- explicit notices that this is not a medical record

## Main residual risks

The app can still contribute to harm if users enter the wrong patient, forget to update a job, misread local workflow labels as clinical priority, over-rely on it instead of formal systems, lose their phone, or expose copied identifiers via clipboard.

See `docs/HAZARD_LOG.md` for the first hazard log.

## Before any real-world deployment

A real deployment would require proper clinical safety, information governance, data protection, usability, security, and organisational approval work. That is deliberately not claimed here.


### Added workflow aids boundary

Shift mode, end-of-shift review, Waiting for, Chase, sort/group controls, undo history, and haptics are implemented as local ergonomics only. They must not be described as clinical safety controls, escalation prompts, reminders, audit logs, or formal handover evidence. Waiting/chase text is plain user-entered text; the app does not infer urgency or advise action.
