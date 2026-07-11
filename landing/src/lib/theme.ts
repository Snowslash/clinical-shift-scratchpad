import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "sangeevSiteTheme";
const COOKIE_NAME = STORAGE_KEY;

function readCookie(): Theme | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=(light|dark)`));
  return match?.[1] as Theme | null;
}

function initialTheme(): Theme {
  const cookie = readCookie();
  if (cookie) return cookie;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable; continue with the system preference.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1d1b18" : "#f4f0e8");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The cross-subdomain cookie still carries the preference when storage is unavailable.
    }
    const cookie = [`${COOKIE_NAME}=${theme}`, "Path=/", "Max-Age=31536000", "SameSite=Lax"];
    if (window.location.hostname === "sangeev.me" || window.location.hostname.endsWith(".sangeev.me")) cookie.push("Domain=.sangeev.me");
    if (window.location.protocol === "https:") cookie.push("Secure");
    document.cookie = cookie.join("; ");
  }, [theme]);
  return { theme, toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark") };
}
