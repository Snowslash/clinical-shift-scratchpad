import type { ProjectPageData } from "./ProjectPage";

// Everything on the project page that is specific to this project. The layout lives in ProjectPage.
export const project: ProjectPageData = {
  key: "scratchpad",
  name: "Clinical Shift Scratchpad",
  tagline: "A ward-job list for one shift",
  description: "A quick list for ward jobs during a shift. It stays on your device and clears itself when you’re done.",
  why: "I made it because jobs kept ending up split between paper, screenshots and my memory during busy shifts.",
  actions: [],
  actionNote: "It’s a phone app, so there’s no web version to open.",
  sourceHref: "https://github.com/Snowslash/clinical-shift-scratchpad",
  beforeYouUse: [
    "Don’t put anything that could identify a patient in the app, in screenshots or in the code.",
    "Your jobs stay on your phone. There’s no account, and nothing is sent anywhere.",
    "Jobs expire after 24 hours unless you change the setting. They’re removed when the app next checks the list. If you copy the end-of-shift summary, other apps on your phone can read it.",
  ],
  shotsNote: "Screenshots from the app, with made-up example jobs.",
  shots: [
    {
      src: "/assets/scratchpad-active-list.webp",
      alt: "A list of made-up ward jobs. Each shows where it is, how urgent it is, how far along it is, and buttons to update it.",
      width: 560,
      height: 1139,
      caption: "Your jobs, grouped so you can scan and update them quickly.",
    },
    {
      src: "/assets/scratchpad-edit-job.webp",
      alt: "Editing a made-up job, with saved phrases you can tap in and buttons to set the type of job and how urgent it is.",
      width: 560,
      height: 1131,
      caption: "Editing a job, with the usual fields and your saved phrases close at hand.",
    },
  ],
  capabilities: [
    ["Write first, tidy later", "Type the job as plain text, then add ward, urgency, status or type if it helps."],
    ["Keep the list moving", "Pin a job, copy it, move it to the top or update it, without it turning into a formal record."],
    ["Fit a long list on screen", "Compact cards and a few sort orders keep a busy list easy to scan."],
    ["Let it clear itself", "Jobs stay on your phone and expire on their own instead of piling up."],
  ],
  limits: "This is a personal prototype I’ve used on my own shifts, not finished software. It hasn’t been through the formal safety, regulatory and data-protection checks a clinical product would need, and it doesn’t keep a record of changes.",
};
