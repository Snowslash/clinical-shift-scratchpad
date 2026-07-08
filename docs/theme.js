(function () {
  const STORAGE_KEY = "sangeevSiteTheme";
  const COOKIE_NAME = STORAGE_KEY;
  const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");

  function normaliseTheme(theme) {
    return theme === "dark" ? "dark" : theme === "light" ? "light" : null;
  }

  function getCookieTheme() {
    const cookie = document.cookie
      .split(";")
      .map(function (part) { return part.trim(); })
      .find(function (part) { return part.indexOf(COOKIE_NAME + "=") === 0; });

    if (!cookie) {
      return null;
    }

    return normaliseTheme(decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)));
  }

  function getStoredTheme() {
    try {
      return normaliseTheme(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return null;
    }
  }

  function persistStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // Storage can be unavailable in strict/local contexts; keep the page usable.
    }
  }

  function persistCookieTheme(theme) {
    try {
      const parts = [
        COOKIE_NAME + "=" + encodeURIComponent(theme),
        "Max-Age=" + COOKIE_MAX_AGE_SECONDS,
        "Path=/",
        "SameSite=Lax"
      ];

      if (window.location.hostname === "sangeev.me" || window.location.hostname.endsWith(".sangeev.me")) {
        parts.push("Domain=.sangeev.me");
      }

      if (window.location.protocol === "https:") {
        parts.push("Secure");
      }

      document.cookie = parts.join("; ");
    } catch (error) {
      // Cookies can be blocked; localStorage fallback still covers this origin.
    }
  }

  function persistTheme(theme) {
    persistStoredTheme(theme);
    persistCookieTheme(theme);
  }

  function setTheme(theme) {
    const normalisedTheme = normaliseTheme(theme) || "light";
    const isDark = normalisedTheme === "dark";
    root.dataset.theme = normalisedTheme;

    if (toggle) {
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      toggle.innerHTML = isDark
        ? '<span aria-hidden="true">☀</span><span>Light</span>'
        : '<span aria-hidden="true">☾</span><span>Dark</span>';
    }

    persistTheme(normalisedTheme);
  }

  setTheme(getCookieTheme() || getStoredTheme() || root.dataset.theme || "light");

  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }
}());
