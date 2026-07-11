import { Moon, Sun } from "lucide-react";
import type { Theme } from "../lib/theme";

type ThemeToggleProps = { theme: Theme; onToggle: () => void };

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === "dark";
  return (
    <button className="theme-toggle" type="button" onClick={onToggle} aria-label={`Switch to ${isDark ? "light" : "dark"} mode`} aria-pressed={isDark}>
      {isDark ? <Sun aria-hidden="true" size={15} /> : <Moon aria-hidden="true" size={15} />}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
