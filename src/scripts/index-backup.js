document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('backupReloadBtn')?.addEventListener('click', () => window.location.reload());
  document.getElementById('backupDismissBtn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const container = btn.closest('.error-boundary') || btn.parentElement?.parentElement;
    if (container) container.remove();
  });
});

export default {};
