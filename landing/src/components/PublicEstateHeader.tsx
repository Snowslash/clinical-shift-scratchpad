import { ThemeToggle } from "./ThemeToggle";
import type { Theme } from "../lib/theme";

export type PublicEstatePage = "home" | "opnotes" | "scratchpad" | "aligned";

type PublicEstateHeaderProps = { current: PublicEstatePage; theme: Theme; onToggleTheme: () => void };

const links = [
  { page: "home", label: "Tools", href: "https://sangeev.me/#tools" },
  { page: "opnotes", label: "Op notes", href: "https://opnotes.sangeev.me" },
  { page: "scratchpad", label: "Scratchpad", href: "https://scratchpad.sangeev.me" },
  { page: "aligned", label: "AlignEd", href: "https://aligned.sangeev.me" },
] as const;

export function PublicEstateHeader({ current, theme, onToggleTheme }: PublicEstateHeaderProps) {
  return (
    <header className="site-header" data-print-hidden>
      <a className="wordmark" href="https://sangeev.me" aria-current={current === "home" ? "page" : undefined}>Sangeev</a>
      <nav aria-label="Primary navigation">
        {links.map((link) => (
          <a key={link.page} href={link.href} aria-current={current === link.page && current !== "home" ? "page" : undefined}>{link.label}</a>
        ))}
      </nav>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
