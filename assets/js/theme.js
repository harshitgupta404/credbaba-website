// Theme handling: respects saved preference, else system preference.
// Applied immediately (before paint) via inline script in <head> of each page
// to avoid a flash of wrong theme; this file wires up the toggle button.
(function () {
  function getStoredTheme() {
    try { return localStorage.getItem('credbaba-theme'); } catch (e) { return null; }
  }
  function setStoredTheme(theme) {
    try { localStorage.setItem('credbaba-theme', theme); } catch (e) {}
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach(function (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current);

    var toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        setStoredTheme(next);
        applyTheme(next);
      });
    });
  });
})();
