(function () {
  const STORAGE_KEY = "sangeevSiteTheme";
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // Storage can be unavailable in strict/local contexts; keep the page usable.
    }
  }

  function setTheme(theme) {
    const normalisedTheme = theme === "dark" ? "dark" : "light";
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

  setTheme(getStoredTheme() || root.dataset.theme || "dark");

  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }
}());
