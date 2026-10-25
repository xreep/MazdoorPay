// Runs before the page paints, so dark mode never flashes white: the saved choice, else the
// system setting. (An external file because the security policy allows no inline scripts.)
(function () {
  var saved = null;
  try {
    saved = localStorage.getItem('mp-theme');
  } catch {
    // Storage blocked: follow the system.
  }
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
  if (dark) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#12161D');
  }
})();
