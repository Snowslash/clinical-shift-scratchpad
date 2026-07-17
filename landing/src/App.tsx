import { ArrowLeft, ArrowUpRight, Github } from "lucide-react";
import {
  EstateBoundary,
  EstateEvidenceFrame,
  EstatePageTitle,
  EstateSectionTitle,
  EstateShell,
  PublicEstateHeader,
  useEstateTheme,
} from "@sangeev/estate-ui";

const capabilities = [
  ["Capture first", "Start with free text, then add location, urgency, status and job type when they help."],
  ["Keep the list moving", "Pin, duplicate, bump and update jobs without turning the scratchpad into a record system."],
  ["Work densely", "Compact cards and local sort presets keep longer shift lists scannable."],
  ["Let it expire", "Jobs stay on the device and can expire automatically instead of accumulating indefinitely."],
];

function App() {
  const { theme, toggleTheme } = useEstateTheme();

  return (
    <>
      <PublicEstateHeader current="scratchpad" theme={theme} onToggleTheme={toggleTheme} />
      <EstateShell variant="landing">
        <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <a className="back-link" href="https://sangeev.me"><ArrowLeft size={15} aria-hidden="true" /> Public tools</a>
            <EstatePageTitle id="page-title" variant="landing">Clinical Shift Scratchpad</EstatePageTitle>
            <p className="project-summary">A temporary ward-job list that stays on the device.</p>
            <p className="lede">
              I made it because jobs kept ending up split between paper, screenshots and memory during busy shifts. Capture the job quickly, add only the structure that helps, then clear it when the shift is done.
            </p>
            <div className="hero-actions">
              <a className="estate-primary-action" href="https://github.com/Snowslash/clinical-shift-scratchpad"><Github size={17} aria-hidden="true" /> Source on GitHub</a>
            </div>
          </div>

          <EstateBoundary className="hero-boundary" label="Safety and privacy boundary">
            <p><strong>Do not enter patient-identifiable information into this website or repository.</strong></p>
            <p>Runtime data should stay on the device. No backend, login, cloud sync, analytics, messaging, AI or EHR integration.</p>
          </EstateBoundary>
        </section>

        <section className="evidence" aria-labelledby="evidence-title">
          <div className="section-heading">
            <EstateSectionTitle id="evidence-title">Built for the busy middle of a shift.</EstateSectionTitle>
            <p>These are synthetic examples from the app. They show the current prototype, not a live clinical system.</p>
          </div>

          <div className="screenshots">
            <figure className="screenshot screenshot-primary">
              <EstateEvidenceFrame as="div" className="image-frame">
                <img src="/assets/scratchpad-active-list.webp" alt="Clinical Shift Scratchpad showing a synthetic active jobs list with status, urgency, location and action controls." width="560" height="1139" />
              </EstateEvidenceFrame>
              <figcaption>Active jobs grouped for quick scanning and updating.</figcaption>
            </figure>
            <figure className="screenshot screenshot-secondary">
              <EstateEvidenceFrame as="div" className="image-frame">
                <img src="/assets/scratchpad-edit-job.webp" alt="Clinical Shift Scratchpad edit screen with synthetic job details, local phrase shortcuts, job type and urgency controls." width="560" height="1131" />
              </EstateEvidenceFrame>
              <figcaption>The edit view keeps common fields and local shortcuts close.</figcaption>
            </figure>
          </div>
        </section>

        <section className="capabilities" aria-labelledby="capabilities-title">
          <div className="section-heading compact">
            <EstateSectionTitle id="capabilities-title">A scratchpad, deliberately.</EstateSectionTitle>
          </div>
          <div className="capability-grid">
            {capabilities.map(([title, description]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="status-band" aria-labelledby="status-title">
          <div>
            <EstateSectionTitle id="status-title">Personal prototype. Narrow on purpose.</EstateSectionTitle>
            <p>Field-tested by me, but not production software. There is no formal clinical safety case, regulatory assurance, audit trail or GDPR-assured service.</p>
          </div>
          <a href="https://github.com/Snowslash/clinical-shift-scratchpad">Read the project notes <ArrowUpRight size={17} aria-hidden="true" /></a>
        </section>
      </main>

      <footer>
        <p>Clinical Shift Scratchpad · Maintained by Sangeev</p>
        <a href="https://sangeev.me">Back to sangeev.me</a>
        </footer>
      </EstateShell>
    </>
  );
}

export default App;
