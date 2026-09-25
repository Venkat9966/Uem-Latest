// Lightweight front-end deterrents (client-side only; not a security boundary)
// - Disable right-click context menu
// - Block common inspect-key combos

(function () {
  function prevent(e) { e.preventDefault(); }

  // Do NOT disable right-click — make deterrent non-blocking to avoid interfering with UI
  // (Some browsers/OS combinations can treat contextmenu suppression as a user-interaction blocker.)

  // disable some keys: F12, Ctrl+Shift+I/J/C, Ctrl+U
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F12') return e.preventDefault();
    if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) return e.preventDefault();
    if (e.ctrlKey && ['U', 'u'].includes(e.key)) return e.preventDefault();
  });

  // Small UX: show tooltip once informing users right-click is disabled
  try {
    if (!sessionStorage.getItem('rc_disabled_seen')) {
      const tip = document.createElement('div');
      tip.textContent = 'Right-click and inspect are disabled on this site.';
      tip.style.position = 'fixed';
      tip.style.bottom = '12px';
      tip.style.right = '12px';
      tip.style.background = 'rgba(0,0,0,0.7)';
      tip.style.color = 'white';
      tip.style.padding = '8px 10px';
      tip.style.borderRadius = '6px';
      tip.style.zIndex = 1000;
      // Ensure the tooltip does not capture pointer events so it cannot block clicks
      tip.style.pointerEvents = 'none';
      document.body.appendChild(tip);
      setTimeout(() => tip.remove(), 4000);
      sessionStorage.setItem('rc_disabled_seen', '1');
    }
  } catch (e) {}
})();
