// Rhymo blog: the "copy link" button. Everything else on blog pages is plain HTML.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-link');
  if (!btn) return;
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(btn.dataset.url);
    btn.textContent = btn.dataset.done || 'Copied';
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 1800);
  } catch {
    window.prompt('', btn.dataset.url);
  }
});
